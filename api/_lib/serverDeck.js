/**
 * Server-side answer pool (same packs/dedupe as src/engine/deck.ts, without
 * runtime Taller patches). Used to refill bot hands after server auto-submit.
 * Static requires so Vercel bundles the JSON with the function.
 */
let PACKS = null;
function packs() {
  if (PACKS) return PACKS;
  PACKS = {
    _banned: require('../../deck/packs/_banned.json'),
    core: require('../../deck/packs/core.json'),
    politica: require('../../deck/packs/politica.json'),
    celebridades: require('../../deck/packs/celebridades.json'),
    plus18: require('../../deck/packs/plus18.json'),
    economia: require('../../deck/packs/economia.json'),
    animales: require('../../deck/packs/animales.json'),
    sexo: require('../../deck/packs/sexo.json'),
    drogas: require('../../deck/packs/drogas.json'),
    familia: require('../../deck/packs/familia.json'),
    religion: require('../../deck/packs/religion.json'),
    tech: require('../../deck/packs/tech.json'),
    salud: require('../../deck/packs/salud.json'),
    espana: require('../../deck/packs/espana.json'),
  };
  return PACKS;
}

const poolCache = new Map();

function answerPool(packIds) {
  const P = packs();
  const ids = (packIds || []).filter((id) => id !== '_banned' && P[id]);
  const use = ids.length ? ids : ['core'];
  const key = use.join('|');
  if (poolCache.has(key)) return poolCache.get(key);
  const banned = new Set(((P._banned && P._banned.cards) || []).map((c) => c.id));
  const seenIds = new Set();
  const seenTexts = new Set();
  const out = [];
  for (const id of use) {
    for (const card of P[id].cards || []) {
      if (banned.has(card.id) || seenIds.has(card.id)) continue;
      const norm = String(card.text || '').trim().toLocaleLowerCase('es-ES');
      if (seenTexts.has(norm)) continue;
      seenIds.add(card.id);
      seenTexts.add(norm);
      if (card.type === 'answer') out.push({ ...card, sourcePack: id });
    }
  }
  poolCache.set(key, out);
  return out;
}

/** n random answers not in any hand / in play. */
function drawFresh(state, n) {
  if (n <= 0) return [];
  const occupied = new Set();
  for (const p of state.players || []) for (const c of (p && p.hand) || []) occupied.add(c.id);
  for (const s of state.submissions || []) for (const c of (s && s.cards) || []) occupied.add(c.id);
  const pool = answerPool(state.packIds).filter((c) => !occupied.has(c.id));
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const j = Math.floor(Math.random() * pool.length);
    out.push(pool[j]);
    pool[j] = pool[pool.length - 1];
    pool.pop();
  }
  return out;
}

module.exports = { answerPool, drawFresh };
