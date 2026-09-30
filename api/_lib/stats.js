/**
 * Lightweight analytics in Upstash (no login). Per day (Europe/Madrid):
 *   gc:st:d:<day>    HASH counters (rooms_created, matches_started, matches_finished,
 *                    rematches, rounds, mode_vote, mode_zar, humans_<n>, players_sum, bots_sum)
 *   gc:st:dau:<day>  HyperLogLog of anonymous device ids (unique devices)
 *   gc:st:ret:<day>  HyperLogLog of devices first seen on an earlier day (returning)
 *   gc:st:dev:<id>   first-seen day for a device (SET NX)
 */
const TTL = String(400 * 24 * 3600);

function dayKey(d = new Date()) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

function roomEvents(existing, state) {
  const ev = [];
  if (!state) return ev;
  const round = Number(state.round) || 0;
  if (!existing) {
    ev.push(['rooms_created', 1]);
    return ev;
  }
  const ep = existing.phase;
  const sp = state.phase;
  const players = (state.players || []).filter(Boolean);
  const humans = players.filter((p) => !p.isBot).length;
  const bots = players.length - humans;
  const started = (ep === 'lobby' && sp !== 'lobby') ||
    (ep === 'results' && (sp === 'submitting' || sp === 'discarding') && round <= 1);
  if (started) {
    ev.push(['matches_started', 1]);
    if (ep === 'results') ev.push(['rematches', 1]);
    ev.push([`mode_${state.judgeMode === 'vote' ? 'vote' : 'zar'}`, 1]);
    ev.push([`humans_${humans}`, 1]);
    ev.push(['players_sum', players.length]);
    ev.push(['bots_sum', bots]);
  }
  if (ep === 'judging' && (sp === 'reveal' || sp === 'results')) ev.push(['rounds', 1]);
  if (ep !== 'results' && sp === 'results') ev.push(['matches_finished', 1]);
  return ev;
}

/** Never throws; a few HINCRBY in one pipeline, only on transitions. */
async function recordRoom(kvPipeline, existing, state) {
  try {
    const ev = roomEvents(existing, state);
    if (!ev.length) return;
    const key = `gc:st:d:${dayKey()}`;
    const cmds = ev.map(([f, n]) => ['HINCRBY', key, f, String(n)]);
    cmds.push(['EXPIRE', key, TTL]);
    await kvPipeline(cmds);
  } catch {
    /* analytics must never break play */
  }
}

async function recordDevice(kvPipeline, deviceId) {
  const day = dayKey();
  const r = await kvPipeline([
    ['PFADD', `gc:st:dau:${day}`, deviceId],
    ['EXPIRE', `gc:st:dau:${day}`, TTL],
    ['SET', `gc:st:dev:${deviceId}`, day, 'NX', 'EX', TTL],
    ['GET', `gc:st:dev:${deviceId}`],
  ]);
  const first = r[3] && r[3].result;
  const returning = !!first && first !== day;
  if (returning) {
    await kvPipeline([
      ['PFADD', `gc:st:ret:${day}`, deviceId],
      ['EXPIRE', `gc:st:ret:${day}`, TTL],
      ['EXPIRE', `gc:st:dev:${deviceId}`, TTL],
    ]);
  }
  return { day, returning };
}

async function readDays(kvPipeline, days) {
  const list = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) list.push(dayKey(new Date(now - i * 86400000)));
  const cmds = [];
  for (const d of list) {
    cmds.push(['HGETALL', `gc:st:d:${d}`]);
    cmds.push(['PFCOUNT', `gc:st:dau:${d}`]);
    cmds.push(['PFCOUNT', `gc:st:ret:${d}`]);
  }
  cmds.push(['PFCOUNT', ...list.map((d) => `gc:st:dau:${d}`)]);
  const r = await kvPipeline(cmds);
  const out = list.map((d, i) => {
    const flat = (r[i * 3] && r[i * 3].result) || [];
    const counters = {};
    for (let j = 0; j + 1 < flat.length; j += 2) counters[flat[j]] = Number(flat[j + 1]) || 0;
    return {
      date: d,
      ...counters,
      unique_devices: Number(r[i * 3 + 1] && r[i * 3 + 1].result) || 0,
      returning_devices: Number(r[i * 3 + 2] && r[i * 3 + 2].result) || 0,
    };
  });
  const total = Number(r[list.length * 3] && r[list.length * 3].result) || 0;
  return { days: out, unique_devices_range: total };
}

module.exports = { dayKey, roomEvents, recordRoom, recordDevice, readDays };
