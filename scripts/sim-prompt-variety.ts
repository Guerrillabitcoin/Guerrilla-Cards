/**
 * Quick variety check: 3 Solo-sized draws × 10 with growing avoid list.
 * Run: npx tsx scripts/sim-prompt-variety.ts
 */
import {
  buildVariedPromptDeck,
  loadCombinedDeck,
} from '../src/engine/deck';

const packs = [
  'core',
  'politica',
  'celebridades',
  'economia',
  'animales',
  'familia',
  'tech',
  'salud',
  'espana',
  'plus18',
  'sexo',
  'drogas',
  'religion',
];

const { prompts } = loadCombinedDeck(packs);
const recent: string[] = [];
const seenGlobal = new Set<string>();
let repeatsInEarly = 0;
const earlyN = 10;
const games = 5;

for (let g = 0; g < games; g++) {
  const deck = buildVariedPromptDeck(prompts, recent);
  const draw = deck.slice(0, earlyN).map((c) => c.id);
  for (const id of draw) {
    if (seenGlobal.has(id)) repeatsInEarly++;
    seenGlobal.add(id);
    recent.unshift(id);
  }
  // dedupe recent preserve order
  const uniq: string[] = [];
  const s = new Set<string>();
  for (const id of recent) {
    if (s.has(id)) continue;
    s.add(id);
    uniq.push(id);
  }
  recent.length = 0;
  recent.push(...uniq.slice(0, 500));
  console.log(
    `game ${g + 1}: first ${earlyN} unique-in-game=${new Set(draw).size}, pool=${prompts.length}, avoid=${recent.length}`
  );
}

console.log(
  `Across ${games}×${earlyN} draws: repeats of previously-seen prompts in early slots = ${repeatsInEarly}`
);
if (repeatsInEarly > 2) {
  console.error('FAIL: too many early repeats');
  process.exit(1);
}
console.log('PASS');
