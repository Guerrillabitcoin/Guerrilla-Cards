/**
 * Vercel serverless: cross-device async rooms via Vercel KV / Upstash Redis REST.
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *
 * Upsert merges hands by player id and submissions (prefer real card text while
 * submitting; prefer full incoming on judging/reveal/results with real-text fallback).
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
  if (merged.length > ASYNC_MAX_PLAYERS) {
    return merged.slice(0, ASYNC_MAX_PLAYERS);
  }
  return merged;
}

function isRedactedCardText(text) {
  if (text == null) return true;
  const t = String(text).trim();
  return t === '' || t === '…' || t === '...';
}

function hasRealCardText(cards) {
  return (cards || []).some((c) => c && !isRedactedCardText(c.text));
}

/**
 * Merge hands by player id: non-empty incoming wins; else keep existing hand.
 * Player list follows incoming order/ids; fills hands from existing when blanked.
 */
function mergeHandsByPlayerId(existingPlayers, incomingPlayers) {
  const existingById = new Map();
  for (const p of existingPlayers || []) {
    if (p && p.id) existingById.set(p.id, p);
  }
  return (incomingPlayers || []).map((p) => {
    if (!p || !p.id) return p;
    const ex = existingById.get(p.id);
    if (p.hand && p.hand.length > 0) return p;
    if (ex && ex.hand && ex.hand.length > 0) {
      return { ...p, hand: ex.hand };
    }
    return p;
  });
}

/**
 * Merge submissions by playerId preferring real (non-redacted) card text.
 */
function mergeSubmissionsPreferReal(existingSubs, incomingSubs) {
  const byId = new Map();
  for (const s of existingSubs || []) {
    if (s && s.playerId) byId.set(s.playerId, s);
  }
  for (const s of incomingSubs || []) {
    if (!s || !s.playerId) continue;
    const ex = byId.get(s.playerId);
    if (!ex) {
      byId.set(s.playerId, s);
      continue;
    }
    if (hasRealCardText(s.cards)) {
      byId.set(s.playerId, s);
    } else if (hasRealCardText(ex.cards)) {
      // keep existing real
    } else {
      byId.set(s.playerId, s);
    }
  }
  return Array.from(byId.values());
}

function mergeSubmissions(existing, incoming) {
  const incomingPhase = incoming?.phase;
  const existingPhase = existing?.phase;
  const revealPhases = ['judging', 'reveal', 'results'];

  if (revealPhases.includes(incomingPhase)) {
    // Prefer incoming (full) but fall back to existing real text per player
    // so a last-submitter push with fogged peers does not wipe answers.
    return mergeSubmissionsPreferReal(
      existing?.submissions,
      incoming?.submissions
    );
  }

  if (
    (incomingPhase === 'submitting' || incomingPhase === 'discarding') &&
    (existingPhase === 'submitting' ||
      existingPhase === 'discarding' ||
      existingPhase === 'lobby' ||
      !existingPhase)
  ) {
    return mergeSubmissionsPreferReal(
      existing?.submissions,
      incoming?.submissions
    );
  }

  return incoming?.submissions ?? existing?.submissions ?? [];
}

function applyPrivacyMerges(existing, incoming) {
  if (!existing || typeof existing !== 'object') return incoming;
  const players = mergeHandsByPlayerId(existing.players, incoming.players);
  const submissions = mergeSubmissions(existing, incoming);
  return { ...incoming, players, submissions };
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
          // Also merge hands on lobby seats (usually empty)
          const withHands = mergeHandsByPlayerId(
            existing.players,
            mergedPlayers
          );
          const base =
            remoteNewer ||
            (existing.players?.length ?? 0) > (incoming.players?.length ?? 0)
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
            players: withHands,
            packIds: base.packIds?.length ? base.packIds : incoming.packIds,
            mode: base.mode || incoming.mode,
            judgeMode: base.judgeMode || incoming.judgeMode,
            targetScore: base.targetScore ?? incoming.targetScore,
            submissions: mergeSubmissions(existing, {
              ...incoming,
              phase: 'lobby',
            }),
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
        } else {
          // Accept incoming (newer or equal) but merge hands + submissions
          state = applyPrivacyMerges(existing, incoming);
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
