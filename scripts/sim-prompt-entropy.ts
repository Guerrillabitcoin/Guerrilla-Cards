/**
 * Entropy / uniformity of first-draw prompts under buildVariedPromptDeck.
 * Run: npx tsx scripts/sim-prompt-entropy.ts
 */
import {
  buildVariedPromptDeck,
  loadCombinedDeck,
  shuffle,
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
const N = prompts.length;
const TRIALS = 8000;
const TOP_K = 10; // first K slots of a Solo-like match

function chiSquare(counts: number[], expected: number): number {
  let x = 0;
  for (const c of counts) {
    const d = c - expected;
    x += (d * d) / expected;
  }
  return x;
}

/** Shannon entropy of empirical distribution (bits). */
function entropyBits(counts: number[], total: number): number {
  let h = 0;
  for (const c of counts) {
    if (!c) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

function run(label: string, build: (avoid: string[]) => ReturnType<typeof buildVariedPromptDeck>) {
  const firstCounts = new Array(N).fill(0);
  const idIndex = new Map(prompts.map((p, i) => [p.id, i]));
  const slotCounts = Array.from({ length: TOP_K }, () => new Array(N).fill(0));
  let avoid: string[] = [];

  for (let t = 0; t < TRIALS; t++) {
    // Cold start every 20 trials (new browser) else growing recents like real play
    if (t % 20 === 0) avoid = [];
    const deck = build(avoid);
    for (let k = 0; k < TOP_K; k++) {
      const card = deck[k];
      const idx = idIndex.get(card.id)!;
      slotCounts[k][idx]++;
      if (k === 0) firstCounts[idx]++;
    }
    // Remember this match's early draws
    const used = deck.slice(0, TOP_K).map((c) => c.id);
    avoid = [...used, ...avoid.filter((id) => !used.includes(id))].slice(0, 500);
  }

  const expectedFirst = TRIALS / N;
  const hMax = Math.log2(N);
  const h = entropyBits(firstCounts, TRIALS);
  const chi = chiSquare(firstCounts, expectedFirst);
  const hit = firstCounts.filter((c) => c > 0).length;
  const minC = Math.min(...firstCounts);
  const maxC = Math.max(...firstCounts);

  console.log(`\n=== ${label} ===`);
  console.log(`pool=${N} trials=${TRIALS} (first-slot)`);
  console.log(
    `entropy=${h.toFixed(3)} bits / max=${hMax.toFixed(3)} (${((100 * h) / hMax).toFixed(2)}%)`
  );
  console.log(
    `chi²=${chi.toFixed(1)} (df≈${N - 1}); unique hit=${hit}/${N}; min/max counts=${minC}/${maxC}`
  );
  // Pack share in first slot vs natural pack weight
  const packNat: Record<string, number> = {};
  const packHit: Record<string, number> = {};
  for (const p of prompts) {
    const k = p.sourcePack || '_';
    packNat[k] = (packNat[k] ?? 0) + 1;
  }
  for (let i = 0; i < N; i++) {
    const k = prompts[i].sourcePack || '_';
    packHit[k] = (packHit[k] ?? 0) + firstCounts[i];
  }
  console.log('first-slot pack % vs natural %:');
  for (const k of Object.keys(packNat).sort()) {
    const nat = (100 * packNat[k]) / N;
    const got = (100 * (packHit[k] ?? 0)) / TRIALS;
    console.log(`  ${k.padEnd(14)} natural ${nat.toFixed(1)}%  got ${got.toFixed(1)}%`);
  }
  return { h, hMax, chi };
}

const uniform = run('uniform Fisher–Yates (target)', () => shuffle(prompts));
const varied = run('buildVariedPromptDeck (live)', (avoid) =>
  buildVariedPromptDeck(prompts, avoid)
);

const ratio = varied.h / uniform.h;
console.log(
  `\nEntropy vs pure shuffle: ${(100 * ratio).toFixed(2)}% (want ≥ 98% on cold+warm mix)`
);
if (ratio < 0.97) {
  console.error('FAIL: entropy too low vs uniform');
  process.exit(1);
}
console.log('PASS');
