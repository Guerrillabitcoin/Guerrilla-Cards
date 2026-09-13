/**
 * User bug/fault reports from the app.
 * Shows up in Vercel Runtime Logs as guerrilla_user_report.
 */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const message = String(body.message || '').trim().slice(0, 2000);
  if (message.length < 3) {
    return res.status(400).json({ ok: false, error: 'empty' });
  }

  const payload = {
    type: 'guerrilla_user_report',
    v: String(body.v || 'unknown').slice(0, 20),
    ts: Date.now(),
    clientTs: body.ts || null,
    message,
    context: String(body.context || '').slice(0, 500),
    path: String(body.path || '').slice(0, 200),
    ua: String(body.ua || '').slice(0, 300),
  };

  console.log(JSON.stringify(payload));

  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) {
      const key = `gc:reports:${new Date().toISOString().slice(0, 10)}`;
      await fetch(`${url}/rpush/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
  } catch (err) {
    console.warn('report_kv_skip', String(err));
  }

  return res.status(200).json({ ok: true });
};
