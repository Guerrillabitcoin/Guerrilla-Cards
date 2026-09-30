/**
 * Per-card aggregate stats for Multi rooms (v0.99.422.31) → future "best cards" print packs.
 *
 * Written inside the room lock: cardStatsCmd() returns ONE Lua EVAL that is appended to the
 * same pipeline as the room SET + unlock (no extra round trip, 1 billable command).
 * Idempotent: each event carries a done-key (SET NX EX); if it already exists the event's
 * increments are skipped, so retries / duplicate pushes never double count.
 *
 * Hashes (field = card id unless noted), namespace gc:cs (real) / gc:cst (ZZT test rooms):
 *   a:played_h a:played_b   answer played by a human / bot
 *   a:won_h    a:won_b      answer was (part of) the winning submission
 *   a:votes                 votes received (vote mode; each card of the submission)
 *   a:unused_h              held by a human who played that round but not chosen
 *   a:disc_h   a:disc_b     discarded at discard rounds
 *   p:shown p:annulled p:won_h p:won_b   prompts (annulled = tie / no winner)
 *   pair                    "<promptId>><ans1>[+<ans2>]" → human wins (capped at PAIR_CAP fields)
 *   meta                    rounds_vote, rounds_zar, rounds_annulled, discards_h, discards_b
 */
const H = [
  'a:played_h', 'a:played_b', 'a:won_h', 'a:won_b', 'a:votes', 'a:unused_h', 'a:disc_h', 'a:disc_b',
  'p:shown', 'p:annulled', 'p:won_h', 'p:won_b', 'pair', 'meta',
];
const IDX = Object.fromEntries(H.map((h, i) => [h, i + 1]));
const PAIR_CAP = 20000;
const DONE_TTL = String(3 * 24 * 3600);

const LUA = [
  'local ttl = ARGV[1]',
  'local cap = tonumber(ARGV[2])',
  'local pairIdx = tonumber(ARGV[3])',
  'local skip = true',
  'local applied = 0',
  'local i = 4',
  'while i <= #ARGV do',
  "  if ARGV[i] == 'D' then",
  "    local ok = redis.call('SET', KEYS[tonumber(ARGV[i+1])], '1', 'NX', 'EX', ttl)",
  '    skip = not ok',
  '    if ok then applied = applied + 1 end',
  '    i = i + 2',
  '  else',
  '    if not skip then',
  '      local ki = tonumber(ARGV[i+1])',
  '      local k = KEYS[ki]',
  '      local f = ARGV[i+2]',
  "      if ki ~= pairIdx or redis.call('HEXISTS', k, f) == 1 or redis.call('HLEN', k) < cap then",
  "        redis.call('HINCRBY', k, f, tonumber(ARGV[i+3]))",
  '      end',
  '    end',
  '    i = i + 4',
  '  end',
  'end',
  'return applied',
].join('\n');

function nsFor(code) {
  return /^ZZT/i.test(String(code || '')) ? 'gc:cst' : 'gc:cs';
}

/** Pure: events for one room write. Exported for tests. */
function cardEvents(existing, state) {
  const out = [];
  if (!existing || !state || state.mode !== 'async') return out;
  const code = String(state.code || existing.code || '').toUpperCase();
  if (!code) return out;
  const byId = new Map((state.players || []).filter(Boolean).map((p) => [p.id, p]));
  const isBot = (id) => !!(byId.get(id) && byId.get(id).isBot);
  const match = Number(existing.leagueMatchCount) || 0;

  // 1) Round resolution (judge pick / vote tally / annul), exactly on the judging→reveal|results edge.
  const resolved =
    (existing.phase === 'judging' || existing.phase === 'submitting') &&
    (state.phase === 'reveal' || state.phase === 'results') &&
    Number(existing.round) === Number(state.round) &&
    state.currentPrompt && state.currentPrompt.id;
  if (resolved) {
    const round = Number(state.round) || 0;
    const promptId = String(state.currentPrompt.id);
    const prevScore = new Map((existing.players || []).filter(Boolean).map((p) => [p.id, Number(p.score) || 0]));
    const winners = new Set(
      (state.players || [])
        .filter((p) => p && (Number(p.score) || 0) > (prevScore.get(p.id) || 0))
        .map((p) => p.id)
    );
    const incs = [];
    const add = (h, f, n = 1) => { if (f && n) incs.push([h, String(f), n]); };
    const votes = state.votes || {};
    const tally = {};
    for (const t of Object.values(votes)) tally[t] = (tally[t] || 0) + 1;
    const judge = state.judgeMode === 'vote' ? null : (existing.players || [])[Number(existing.zarIndex) || 0];
    const submitted = new Set();
    for (const s of state.submissions || []) {
      if (!s || !Array.isArray(s.cards) || s.rival) continue;
      if (s.round != null && Number(s.round) !== round) continue;
      submitted.add(s.playerId);
      const bot = isBot(s.playerId);
      const won = winners.has(s.playerId);
      for (const c of s.cards) {
        if (!c || !c.id) continue;
        add(bot ? 'a:played_b' : 'a:played_h', c.id);
        if (won) add(bot ? 'a:won_b' : 'a:won_h', c.id);
        if (tally[s.playerId]) add('a:votes', c.id, tally[s.playerId]);
      }
      if (won && !bot) add('pair', `${promptId}>${s.cards.map((c) => c && c.id).filter(Boolean).join('+')}`);
    }
    for (const p of state.players || []) {
      if (!p || p.isBot || !submitted.has(p.id)) continue;
      if (judge && judge.id === p.id) continue;
      for (const c of p.hand || []) if (c && c.id) add('a:unused_h', c.id);
    }
    add('p:shown', promptId);
    if (!winners.size) {
      add('p:annulled', promptId);
      add('meta', 'rounds_annulled');
    }
    for (const w of winners) add(isBot(w) ? 'p:won_b' : 'p:won_h', promptId);
    add('meta', state.judgeMode === 'vote' ? 'rounds_vote' : 'rounds_zar');
    out.push({ done: `${nsFor(code)}:done:${code}:${match}:${round}:${promptId}`, incs });
  }

  // 2) Discards (one event per player, whichever write first shows it).
  const seen = new Set();
  const lists = [];
  if (state.phase === 'discarding') lists.push([state.lastDiscarded, state.round]);
  if (existing.phase === 'discarding') lists.push([existing.lastDiscarded, existing.round]);
  for (const [list, rnd] of lists) {
    for (const d of list || []) {
      if (!d || !d.playerId || seen.has(d.playerId) || !Array.isArray(d.cards) || !d.cards.length) continue;
      seen.add(d.playerId);
      const bot = isBot(d.playerId);
      const incs = d.cards.filter((c) => c && c.id).map((c) => [bot ? 'a:disc_b' : 'a:disc_h', String(c.id), 1]);
      incs.push(['meta', bot ? 'discards_b' : 'discards_h', 1]);
      out.push({ done: `${nsFor(code)}:done:${code}:${match}:${Number(rnd) || 0}:d:${d.playerId}`, incs });
    }
  }
  return out;
}

/** One EVAL (or null). Never throws. */
function cardStatsCmd(existing, state) {
  try {
    if (process.env.CARDSTATS_OFF === '1') return null;
    const events = cardEvents(existing, state);
    if (!events.length) return null;
    const ns = nsFor(state.code || existing.code);
    const keys = H.map((h) => `${ns}:${h}`);
    const argv = [DONE_TTL, String(PAIR_CAP), String(IDX.pair)];
    for (const ev of events) {
      keys.push(ev.done);
      argv.push('D', String(keys.length));
      for (const [h, f, n] of ev.incs) argv.push('I', String(IDX[h]), f, String(n));
    }
    return ['EVAL', LUA, String(keys.length), ...keys, ...argv];
  } catch {
    return null;
  }
}

/* ---------- read side (PIN-protected /api/stats?cards=…) ---------- */

async function readAll(kvPipeline, ns) {
  const r = await kvPipeline(H.map((h) => ['HGETALL', `${ns}:${h}`]));
  const out = {};
  H.forEach((h, i) => {
    const res = r[i] && r[i].result;
    const m = {};
    if (Array.isArray(res)) for (let j = 0; j + 1 < res.length; j += 2) m[res[j]] = Number(res[j + 1]) || 0;
    else if (res && typeof res === 'object') for (const [k, v] of Object.entries(res)) m[k] = Number(v) || 0;
    out[h] = m;
  });
  return out;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

function buildReport(all, q, cardIndex) {
  const view = String(q.cards || 'answers');
  const min = Math.max(0, Number(q.min) || 0);
  const limit = Math.max(1, Math.min(5000, Number(q.limit) || 100));
  const look = (id) => (cardIndex && cardIndex.get(id)) || {};
  const meta = all.meta;

  if (view === 'prompts') {
    const ids = new Set(Object.keys(all['p:shown']));
    let rows = [...ids].map((id) => {
      const shown = all['p:shown'][id] || 0;
      const annulled = all['p:annulled'][id] || 0;
      return {
        id, text: look(id).text || '', pack: look(id).pack || '',
        shown, annulled, won_h: all['p:won_h'][id] || 0, won_b: all['p:won_b'][id] || 0,
        annul_rate: shown ? round3(annulled / shown) : 0,
      };
    }).filter((r) => r.shown >= min);
    const sort = String(q.sort || 'shown');
    const key = { shown: 'shown', annulled: 'annulled', annul_rate: 'annul_rate', won: 'won_h' }[sort] || 'shown';
    rows.sort((a, b) => b[key] - a[key] || b.shown - a.shown);
    return { view, total: rows.length, rows: rows.slice(0, limit), meta };
  }

  if (view === 'pairs') {
    let rows = Object.entries(all.pair).map(([k, wins]) => {
      const [pid, ans] = k.split('>');
      const aids = String(ans || '').split('+');
      return {
        prompt_id: pid, prompt: look(pid).text || '',
        answer_ids: aids.join('+'), answers: aids.map((a) => look(a).text || a).join(' | '),
        wins,
      };
    }).filter((r) => r.wins >= Math.max(1, min));
    rows.sort((a, b) => b.wins - a.wins);
    return { view, total: rows.length, rows: rows.slice(0, limit), meta };
  }

  // answers-based views
  const ids = new Set();
  for (const h of ['a:played_h', 'a:played_b', 'a:unused_h', 'a:disc_h', 'a:disc_b']) for (const id of Object.keys(all[h])) ids.add(id);
  let sumW = 0, sumP = 0;
  for (const id of ids) { sumW += all['a:won_h'][id] || 0; sumP += all['a:played_h'][id] || 0; }
  const prior = sumP ? sumW / sumP : 0;
  const M = Math.max(1, Number(q.m) || 5); // Bayesian prior strength (pseudo-plays)
  let rows = [...ids].map((id) => {
    const g = (h) => all[h][id] || 0;
    const played_h = g('a:played_h'), won_h = g('a:won_h'), unused_h = g('a:unused_h');
    return {
      id, text: look(id).text || '', pack: look(id).pack || '',
      played_h, played_b: g('a:played_b'), won_h, won_b: g('a:won_b'), votes: g('a:votes'),
      unused_h, disc_h: g('a:disc_h'), disc_b: g('a:disc_b'),
      winrate_h: played_h ? round3(won_h / played_h) : 0,
      pickrate_h: played_h + unused_h ? round3(played_h / (played_h + unused_h)) : 0,
      fun: round3((won_h + M * prior) / (played_h + M)),
    };
  });
  if (view === 'discarded') {
    rows = rows.filter((r) => r.disc_h >= Math.max(1, min));
    rows.sort((a, b) => b.disc_h - a.disc_h || b.disc_b - a.disc_b);
  } else if (view === 'never') {
    // Held by humans ≥min times, never chosen by a human.
    rows = rows.filter((r) => r.played_h === 0 && r.unused_h >= Math.max(1, min));
    rows.sort((a, b) => b.unused_h - a.unused_h);
  } else if (view === 'neverwon') {
    rows = rows.filter((r) => r.won_h === 0 && r.played_h >= Math.max(1, min));
    rows.sort((a, b) => b.played_h - a.played_h);
  } else {
    rows = rows.filter((r) => r.played_h >= min);
    const sort = String(q.sort || 'fun');
    const key = { fun: 'fun', winrate: 'winrate_h', won: 'won_h', played: 'played_h', votes: 'votes', pickrate: 'pickrate_h', discarded: 'disc_h' }[sort] || 'fun';
    rows.sort((a, b) => b[key] - a[key] || b.played_h - a.played_h);
  }
  return { view, total: rows.length, prior_winrate_h: round3(prior), m: M, rows: rows.slice(0, limit), meta };
}

function toCsv(rows) {
  if (!rows.length) return '\ufeff';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ';' separator + BOM: opens directly in Spanish-locale Excel.
  return '\ufeff' + [cols.join(';'), ...rows.map((r) => cols.map((c) => {
    const v = r[c];
    return typeof v === 'number' && !Number.isInteger(v) ? String(v).replace('.', ',') : esc(v);
  }).join(';'))].join('\r\n');
}

module.exports = { cardEvents, cardStatsCmd, readAll, buildReport, toCsv, nsFor, H, LUA };
