/**
 * Vercel serverless: accepts card telemetry batches from the web app.
 * Appears in Runtime Logs as guerrilla_card_telemetry.
 * Optional: set KV_REST_API_URL + KV_REST_API_TOKEN for daily counters.
 */

const ALLOWED = new Set([
  'card_played',
  'card_discarded',
  'card_won',
  'card_favorited',
]);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = {};
  try {
    body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const raw = Array.isArray(body.events) ? body.events : [];
  const events = raw
    .filter(
      (e) =>
        e &&
        typeof e.cardId === 'string' &&
        e.cardId.length > 0 &&
        e.cardId.length < 120 &&
        typeof e.name === 'string' &&
        ALLOWED.has(e.name)
    )
    .slice(0, 40)
    .map((e) => ({
      name: e.name,
      cardId: e.cardId,
      text: String(e.text || '').slice(0, 40),
      kind: e.kind === 'prompt' ? 'prompt' : 'answer',
      won: Boolean(e.won),
    }));

  console.log(
    JSON.stringify({
      type: 'guerrilla_card_telemetry',
      v: body.v || 'unknown',
      clientTs: body.ts,
      count: events.length,
      events,
    })
  );

  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token && events.length) {
      const day = new Date().toISOString().slice(0, 10);
      for (const ev of events) {
        const key = `gc:card:${day}:${ev.name}:${ev.cardId}`;
        await fetch(`${url}/incrby/${encodeURIComponent(key)}/1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  } catch (err) {
    console.warn('telemetry_kv_skip', String(err));
  }

  return res.status(200).json({ ok: true, accepted: events.length });
};
