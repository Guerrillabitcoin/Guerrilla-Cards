/**
 * Runtime deck overlays in KV. GET is public (clients apply on boot).
 * POST needs pin === PATCH_PIN or body.pin === 'guerrilla'.
 * This is how the Taller updates the live deck without a git commit.
 */
const KEY = 'gc:deck:patches';
const PIN = process.env.PATCH_PIN || 'guerrilla';

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

async function kvCommand(cmd) {
  const res = await fetch(kvUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kvToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`kv_http_${res.status}`);
  return res.json();
}

function emptyPatches() {
  return { version: 1, edits: [], adds: [] };
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyPatches();
  return {
    version: 1,
    edits: Array.isArray(raw.edits) ? raw.edits : [],
    adds: Array.isArray(raw.adds) ? raw.adds : [],
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!kvUrl() || !kvToken()) {
    return res.status(503).json({ ok: false, error: 'kv_not_configured' });
  }
  try {
    if (req.method === 'GET') {
      const data = await kvCommand(['GET', KEY]);
      let raw = data?.result;
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = null;
        }
      }
      return res.status(200).json({ ok: true, patches: normalize(raw) });
    }
    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (String(body.pin || '') !== PIN) {
        return res.status(403).json({ ok: false, error: 'bad_pin' });
      }
      const patches = normalize(body.patches);
      await kvCommand(['SET', KEY, JSON.stringify(patches)]);
      return res.status(200).json({ ok: true, patches });
    }
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.warn('patches_kv_error', String(err));
    return res.status(500).json({ ok: false, error: 'kv_error' });
  }
};
