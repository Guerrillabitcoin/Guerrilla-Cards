import manifestJson from '../../deck/manifest.json';
import bannedPack from '../../deck/packs/_banned.json';
import corePack from '../../deck/packs/core.json';
import politicaPack from '../../deck/packs/politica.json';
import celebridadesPack from '../../deck/packs/celebridades.json';
import plus18Pack from '../../deck/packs/plus18.json';
import economiaPack from '../../deck/packs/economia.json';
import animalesPack from '../../deck/packs/animales.json';
import sexoPack from '../../deck/packs/sexo.json';
import drogasPack from '../../deck/packs/drogas.json';
import familiaPack from '../../deck/packs/familia.json';
import religionPack from '../../deck/packs/religion.json';
import techPack from '../../deck/packs/tech.json';
import saludPack from '../../deck/packs/salud.json';
import espanaPack from '../../deck/packs/espana.json';
import type { Card, PackFile, PackMeta } from './types';

const PACK_FILES: Record<string, PackFile> = {
  core: corePack as PackFile,
  politica: politicaPack as PackFile,
  celebridades: celebridadesPack as PackFile,
  plus18: plus18Pack as PackFile,
  economia: economiaPack as PackFile,
  animales: animalesPack as PackFile,
  sexo: sexoPack as PackFile,
  drogas: drogasPack as PackFile,
  familia: familiaPack as PackFile,
  religion: religionPack as PackFile,
  tech: techPack as PackFile,
  salud: saludPack as PackFile,
  espana: espanaPack as PackFile,
};

const bannedIds = new Set(
  ((bannedPack as PackFile).cards ?? []).map((c) => c.id)
);

export function getPlayablePackMeta(): PackMeta[] {
  return (manifestJson.packs as PackMeta[]).filter((p) => p.playable !== false && p.id !== '_banned');
}

export function getBannedCount(): number {
  return bannedIds.size;
}

export function getManifestTotals() {
  return manifestJson.totals;
}

type PackLiteCard = { id: string; norm: string; kind: 'prompt' | 'answer' };

/** Pre-normalized cards per pack (once). Used for fast selection counts. */
const PACK_LITE: Record<string, PackLiteCard[]> = (() => {
  const out: Record<string, PackLiteCard[]> = {};
  for (const [id, pack] of Object.entries(PACK_FILES)) {
    const list: PackLiteCard[] = [];
    for (const card of pack.cards) {
      if (bannedIds.has(card.id)) continue;
      if (card.type !== 'prompt' && card.type !== 'answer') continue;
      list.push({
        id: card.id,
        norm: card.text.trim().toLocaleLowerCase('es-ES'),
        kind: card.type,
      });
    }
    out[id] = list;
  }
  return out;
})();

const countCache = new Map<string, { prompts: number; answers: number }>();
const deckCache = new Map<
  string,
  {
    prompts: Card[];
    answers: Card[];
    packCounts: Record<string, { prompts: number; answers: number }>;
  }
>();

/**
 * Fast prompt/answer counts for selected packs (dedupe by id + text).
 * Does not allocate Card arrays — safe to call on every pack toggle.
 */
export function countCombinedDeck(packIds: string[]): {
  prompts: number;
  answers: number;
} {
  const selected = packIds.filter((id) => id !== '_banned' && PACK_LITE[id]);
  const key = selected.slice().sort().join('|') || 'core';
  const cached = countCache.get(key);
  if (cached) return cached;

  const ids = selected.length ? selected : ['core'];
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  let prompts = 0;
  let answers = 0;

  for (const id of ids) {
    const list = PACK_LITE[id];
    if (!list) continue;
    for (const card of list) {
      if (seenIds.has(card.id) || seenTexts.has(card.norm)) continue;
      seenIds.add(card.id);
      seenTexts.add(card.norm);
      if (card.kind === 'prompt') prompts++;
      else answers++;
    }
  }

  const result = { prompts, answers };
  countCache.set(key, result);
  return result;
}

/**
 * Build combined playable deck from selected packs.
 * Packs may overlap; cards are deduped by `id` (first pack wins).
 * Never includes banned cards.
 */
export function loadCombinedDeck(packIds: string[]): {
  prompts: Card[];
  answers: Card[];
  packCounts: Record<string, { prompts: number; answers: number }>;
} {
  const selected = packIds.filter((id) => id !== '_banned' && PACK_FILES[id]);
  const key = (selected.length ? selected : ['core']).slice().sort().join('|');
  const cached = deckCache.get(key);
  if (cached) return cached;

  const ids = selected.length ? selected : ['core'];
  const prompts: Card[] = [];
  const answers: Card[] = [];
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  const packCounts: Record<string, { prompts: number; answers: number }> = {};

  for (const id of ids) {
    const pack = PACK_FILES[id];
    if (!pack) continue;
    let p = 0;
    let a = 0;
    for (const card of pack.cards) {
      if (bannedIds.has(card.id)) continue;
      if (seenIds.has(card.id)) continue;
      const norm = card.text.trim().toLocaleLowerCase('es-ES');
      if (seenTexts.has(norm)) continue;
      seenIds.add(card.id);
      seenTexts.add(norm);
      if (card.type === 'prompt') {
        prompts.push({ ...card, sourcePack: id });
        p++;
      } else if (card.type === 'answer') {
        answers.push({ ...card, sourcePack: id });
        a++;
      }
    }
    packCounts[id] = { prompts: p, answers: a };
  }

  const result = { prompts, answers, packCounts };
  deckCache.set(key, result);
  return result;
}

/** Alias used by some call sites / docs */
export const buildDeck = loadCombinedDeck;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle but push recently-seen ids toward the end (drawn later). */
export function shuffleAvoidingIds<T extends { id: string }>(
  items: T[],
  avoidIds: string[]
): T[] {
  if (!avoidIds.length) return shuffle(items);
  const avoid = new Set(avoidIds);
  const fresh = shuffle(items.filter((c) => !avoid.has(c.id)));
  const recent = shuffle(items.filter((c) => avoid.has(c.id)));
  return [...fresh, ...recent];
}

/** @deprecated Not used for prompt decks (pack-round-robin removed). Kept for rare tooling. */
export function interleaveByPack(cards: Card[]): Card[] {
  if (cards.length <= 1) return cards;
  const buckets = new Map<string, Card[]>();
  for (const c of cards) {
    const k = c.sourcePack || '_';
    const list = buckets.get(k);
    if (list) list.push(c);
    else buckets.set(k, [c]);
  }
  const queues = [...buckets.values()].map((q) => shuffle(q));
  // Draw from fullest buckets first each step for balance
  const out: Card[] = [];
  while (queues.some((q) => q.length)) {
    queues.sort((a, b) => b.length - a.length);
    for (const q of queues) {
      if (q.length) out.push(q.shift()!);
    }
  }
  return out;
}

/** Soft fingerprint so similar prompts don't land back-to-back. */
export function promptShape(text: string): string {
  const t = text.trim().toLocaleLowerCase('es-ES');
  const blanks = (t.match(/_+/g) ?? []).length;
  const words = t
    .replace(/_+/g, ' ')
    .replace(/[^0-9a-záéíóúüñ\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const head = words.slice(0, 4).join(' ');
  return `${blanks}|${head}`;
}

/**
 * After packs are merged into ONE prompt pile for the match:
 * 1) Fisher–Yates shuffle the WHOLE pile (not pack-by-pack / round-robin)
 * 2) Each create/restart gets a fresh independent shuffle (different order)
 * 3) Recently-seen ids (this browser) sink to the back — still shuffled among
 *    themselves — so we don't replay the same Qs next match until the cycle ends
 *
 * Do NOT interleave by sourcePack here: that felt like "one from each pack".
 */
export function buildVariedPromptDeck(
  prompts: Card[],
  avoidIds: string[] = []
): Card[] {
  if (!prompts.length) return [];

  const inPool = new Set(prompts.map((c) => c.id));
  const seenSet = new Set<string>();
  for (const id of avoidIds) {
    if (!inPool.has(id) || seenSet.has(id)) continue;
    seenSet.add(id);
  }

  // One mixed order over the entire combined deck, then partition
  const mixed = shuffle(prompts);
  // Extra pass so consecutive creates diverge even more
  const remixed = shuffle(mixed);

  const fresh: Card[] = [];
  const recent: Card[] = [];
  for (const c of remixed) {
    if (seenSet.has(c.id)) recent.push(c);
    else fresh.push(c);
  }
  // Fresh already in random relative order; reshuffle recent block too
  return [...fresh, ...shuffle(recent)];
}

/**
 * Pre-build answer draw pile at match create/restart (NOT mid-round).
 * Several shuffled cycles so play never needs to reshuffle on the fly.
 */
export function buildPreShuffledAnswerDeck(
  answers: Card[],
  avoidIds: string[] = [],
  cycles = 3
): Card[] {
  if (!answers.length) return [];
  const out: Card[] = [];
  out.push(...shuffleAvoidingIds(answers, avoidIds));
  for (let i = 1; i < cycles; i++) {
    out.push(...shuffle(answers));
  }
  return out;
}

/** Greedy pass: swap forward if next shape matches recent window. */
export function spaceOutShapes(cards: Card[], window = 3): Card[] {
  const out = [...cards];
  const shapes = out.map((c) => promptShape(c.text));
  for (let i = 1; i < out.length; i++) {
    let clash = false;
    for (let w = 1; w <= window && i - w >= 0; w++) {
      if (shapes[i - w] === shapes[i]) {
        clash = true;
        break;
      }
    }
    if (!clash) continue;
    let swap = -1;
    for (let j = i + 1; j < Math.min(out.length, i + 12); j++) {
      let ok = true;
      for (let w = 1; w <= window && i - w >= 0; w++) {
        if (shapes[i - w] === shapes[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        swap = j;
        break;
      }
    }
    if (swap > i) {
      const tmp = out[i];
      out[i] = out[swap];
      out[swap] = tmp;
      const ts = shapes[i];
      shapes[i] = shapes[swap];
      shapes[swap] = ts;
    }
  }
  return out;
}

/** Pick next prompt; optionally skip a few if shape matches last prompt. */
export function takeNextPrompt(
  deck: Card[],
  recentShapes: string[]
): { prompt: Card; rest: Card[] } {
  if (!deck.length) throw new Error('Baraja de prompts vacía');
  const blocked = recentShapes.length
    ? new Set(recentShapes.slice(-2))
    : null;
  let idx = 0;
  if (blocked) {
    for (let i = 0; i < Math.min(deck.length, 8); i++) {
      if (!blocked.has(promptShape(deck[i].text))) {
        idx = i;
        break;
      }
    }
  }
  const prompt = deck[idx];
  if (idx === 0) {
    return { prompt, rest: deck.slice(1) };
  }
  const rest = deck.slice(0, idx).concat(deck.slice(idx + 1));
  return { prompt, rest };
}

/** Capitalize first letter (Spanish-safe enough for display). */
export function capitalizeAnswer(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase('es-ES') + t.slice(1);
}

/**
 * Fill prompt blanks. Answer cards are stored in lowercase;
 * capitalize only when the blank starts the sentence (or follows .?!…).
 */
export type FillPart = {
  kind: 'text' | 'answer' | 'blank';
  text: string;
};

function formatAnswerForBlank(promptText: string, offset: number, raw: string): string {
  const before = promptText.slice(0, offset);
  const trimmedBefore = before.replace(/\s+$/u, '');
  const atSentenceStart =
    trimmedBefore.length === 0 || /[.!?…¡¿]\s*$/u.test(trimmedBefore);
  return atSentenceStart ? capitalizeAnswer(raw) : raw;
}

/** Segmented fill for styled UI (answers orange + underline). */
export function fillBlankParts(promptText: string, answers: string[]): FillPart[] {
  const parts: FillPart[] = [];
  const re = /_+/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(promptText))) {
    if (m.index > last) {
      parts.push({ kind: 'text', text: promptText.slice(last, m.index) });
    }
    const raw = answers[idx];
    if (raw === undefined || raw === '______') {
      parts.push({ kind: 'blank', text: m[0] });
    } else {
      parts.push({
        kind: 'answer',
        text: formatAnswerForBlank(promptText, m.index, raw),
      });
    }
    idx++;
    last = m.index + m[0].length;
  }
  if (last < promptText.length) {
    parts.push({ kind: 'text', text: promptText.slice(last) });
  }
  if (idx === 0 && answers.length) {
    return [
      { kind: 'text', text: `${promptText} ` },
      {
        kind: 'answer',
        text: answers
          .filter((a) => a && a !== '______')
          .map((a) => capitalizeAnswer(a))
          .join(' / '),
      },
    ];
  }
  return parts;
}

export function fillBlank(promptText: string, answers: string[]): string {
  return fillBlankParts(promptText, answers)
    .map((p) => p.text)
    .join('');
}
