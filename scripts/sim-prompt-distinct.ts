import { buildVariedPromptDeck, loadCombinedDeck } from '../src/engine/deck';
const packs = ['core','politica','familia','plus18','sexo','economia'];
const { prompts } = loadCombinedDeck(packs);
const a = buildVariedPromptDeck(prompts, []).map((c) => c.id).join(',');
const b = buildVariedPromptDeck(prompts, []).map((c) => c.id).join(',');
const c = buildVariedPromptDeck(prompts, []).map((c) => c.id).join(',');
console.log('deck size', prompts.length);
console.log('a===b', a === b, 'a===c', a === c, 'b===c', b === c);
// pack streak: max consecutive same sourcePack in first 30
function maxStreak(ids: string[]) {
  const byId = new Map(prompts.map((p) => [p.id, p.sourcePack || '_']));
  let best = 1, cur = 1;
  for (let i = 1; i < Math.min(30, ids.length); i++) {
    if (byId.get(ids[i]) === byId.get(ids[i - 1])) cur++;
    else cur = 1;
    best = Math.max(best, cur);
  }
  return best;
}
const ids = a.split(',');
console.log('max same-pack streak in first 30 (random ok if high):', maxStreak(ids));
if (a === b && b === c) {
  console.error('FAIL: identical shuffles');
  process.exit(1);
}
console.log('PASS distinct shuffles');
