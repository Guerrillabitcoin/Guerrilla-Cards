/**
 * Vercel serverless: cross-device async rooms via Vercel KV / Upstash Redis REST.
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *
 * MVP stores full GameState JSON (hands included — not private server-side yet).
 * Prefer Upstash POST array commands so large JSON is not stuffed into URL path.
 */

const ROOM_PREFIX = 'gc:room:';
const MAX_BODY_CHARS = 900_000;
const ASYNC_MAX_PLAYERS = 4;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function kvUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
}

function kvToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
}

function kvConfigured() {
  return !!(kvUrl() && kvToken());
}

async function kvCommand(cmd) {
  const url = kvUrl();
  const token = kvToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`kv_http_${res.status}:${text.slice(0, 120)}`);
  }
  return res.json();
}

function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function parseExisting(raw) {
  if (raw == null || raw === '') return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function mergeLobbyPlayers(existingPlayers, incomingPlayers) {
  const byId = new Map();
  for (const p of existingPlayers || []) {
    if (p && p.id) byId.set(p.id, p);
  }
  for (const p of incomingPlayers || []) {
    if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
  }
  const merged = Array.from(byId.values());
  // Cap at ASYNC max when both are async lobbies; otherwise keep union length
  // but never drop below either side's count preference for hosts already seated.
  if (merged.length > ASYNC_MAX_PLAYERS) {
    return merged.slice(0, ASYNC_MAX_PLAYERS);
  }
  return merged;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!kvConfigured()) {
    return res.status(503).json({ ok: false, error: 'kv_not_configured' });
  }

  try {
    if (req.method === 'GET') {
      const code = normalizeCode(req.query?.code);
      if (!code || code.length < 3) {
        return res.status(400).json({ ok: false, error: 'bad_code' });
      }
      const key = `${ROOM_PREFIX}${code}`;
      const data = await kvCommand(['GET', key]);
      const raw = data?.result;
      if (raw == null || raw === '') {
        return res.status(404).json({ ok: false, error: 'not_found' });
      }
      let state;
      try {
        state = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return res.status(500).json({ ok: false, error: 'corrupt_state' });
      }
      return res.status(200).json({ ok: true, state });
    }

    if (req.method === 'POST') {
      let body = {};
      try {
        body =
          typeof req.body === 'string'
            ? JSON.parse(req.body)
            : req.body || {};
      } catch {
        return res.status(400).json({ ok: false, error: 'invalid_json' });
      }

      const action = body.action || 'upsert';
      if (action !== 'upsert') {
        return res.status(400).json({ ok: false, error: 'unknown_action' });
      }

      const code = normalizeCode(body.code || body.state?.code);
      if (!code || code.length < 3) {
        return res.status(400).json({ ok: false, error: 'bad_code' });
      }
      if (!body.state || typeof body.state !== 'object') {
        return res.status(400).json({ ok: false, error: 'missing_state' });
      }

      const incoming = { ...body.state, code };
      const key = `${ROOM_PREFIX}${code}`;

      // Load existing for merge / stale skip
      const existingData = await kvCommand(['GET', key]);
      const existing = parseExisting(existingData?.result);

      let state = incoming;

      if (existing && typeof existing === 'object') {
        const bothLobby =
          existing.phase === 'lobby' && incoming.phase === 'lobby';
        const remoteNewer =
          (existing.updatedAt ?? 0) > (incoming.updatedAt ?? 0);

        if (bothLobby) {
          // Concurrent host/joiner pushes: union players by id so neither wipes seats
          const mergedPlayers = mergeLobbyPlayers(
            existing.players,
            incoming.players
          );
          const base =
            remoteNewer || (existing.players?.length ?? 0) > (incoming.players?.length ?? 0)
              ? existing
              : incoming;
          const nextUpdated = Math.max(
            Date.now(),
            (existing.updatedAt ?? 0) + 1,
            (incoming.updatedAt ?? 0) + 1
          );
          state = {
            ...base,
            ...incoming,
            code,
            phase: 'lobby',
            players: mergedPlayers,
            // Prefer host/pack/meta from the richer or newer side already in base
            packIds: base.packIds?.length ? base.packIds : incoming.packIds,
            mode: base.mode || incoming.mode,
            judgeMode: base.judgeMode || incoming.judgeMode,
            targetScore: base.targetScore ?? incoming.targetScore,
            updatedAt: nextUpdated,
          };
        } else if (remoteNewer && existing.phase !== incoming.phase) {
          // Remote already progressed (game in progress) — don't clobber
          return res.status(200).json({
            ok: true,
            skipped: true,
            state: existing,
            code,
          });
        } else if (remoteNewer && !bothLobby) {
          // Same phase but remote newer and not a simple lobby merge
          return res.status(200).json({
            ok: true,
            skipped: true,
            state: existing,
            code,
          });
        }
      }

      const payload = JSON.stringify(state);
      if (payload.length > MAX_BODY_CHARS) {
        return res.status(413).json({ ok: false, error: 'state_too_large' });
      }

      await kvCommand(['SET', key, payload]);
      return res.status(200).json({ ok: true, code });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.warn('room_kv_error', String(err));
    return res.status(500).json({ ok: false, error: 'kv_error' });
  }
};
