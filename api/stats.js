/**
 * POST { deviceId }  → counts an anonymous device (unique/returning per day). Public.
 * GET  ?days=14      → daily stats JSON. Needs header x-stats-pin (or ?pin=) equal to
 *                      env STATS_PIN. No default PIN: without STATS_PIN it answers 503.
 */
const crypto = require('crypto');
const { recordDevice, readDays } = require('./_lib/stats');

function kvUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
}
function kvToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
}
async function kvPipeline(cmds) {
  const res = await fetch(kvUrl().replace(/\/+$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kvToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error(`kv_http_${res.status}`);
  const out = await res.json();
  return Array.isArray(out) ? out : [];
}

function pinOk(given) {
  const pin = process.env.STATS_PIN;
  if (!pin) return null;
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(pin));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!kvUrl() || !kvToken()) return res.status(503).json({ ok: false, error: 'kv_not_configured' });
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const id = String(body.deviceId || '');
      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return res.status(400).json({ ok: false, error: 'bad_device' });
      const r = await recordDevice(kvPipeline, id);
      return res.status(200).json({ ok: true, day: r.day });
    }
    if (req.method === 'GET') {
      const ok = pinOk((req.headers && req.headers['x-stats-pin']) || (req.query && req.query.pin));
      if (ok === null) return res.status(503).json({ ok: false, error: 'stats_pin_not_configured' });
      if (!ok) return res.status(403).json({ ok: false, error: 'bad_pin' });
      const days = Math.max(1, Math.min(90, Number(req.query && req.query.days) || 14));
      const data = await readDays(kvPipeline, days);
      return res.status(200).json({ ok: true, ...data });
    }
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (e) {
    console.warn('stats_error', String(e));
    return res.status(500).json({ ok: false, error: 'stats_error' });
  }
};
