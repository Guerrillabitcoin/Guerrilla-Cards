import type { Card, CardType } from './types';

export type PatchEdit = {
  cardId: string;
  text: string;
  pick?: number;
  /** Optional note for export */
  note?: string;
};

export type PatchAdd = {
  /** Stable id used in-game and in export (admin-…) */
  id: string;
  type: CardType;
  text: string;
  pick: number;
  packId: string;
};

export type DeckPatches = {
  version: 1;
  edits: PatchEdit[];
  adds: PatchAdd[];
};

export const EMPTY_PATCHES: DeckPatches = {
  version: 1,
  edits: [],
  adds: [],
};

export function patchesAreEmpty(p: DeckPatches | null | undefined): boolean {
  if (!p) return true;
  return (p.edits?.length ?? 0) === 0 && (p.adds?.length ?? 0) === 0;
}

export function normalizePatches(raw: unknown): DeckPatches {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PATCHES, edits: [], adds: [] };
  const o = raw as Partial<DeckPatches>;
  return {
    version: 1,
    edits: Array.isArray(o.edits)
      ? o.edits.filter(
          (e): e is PatchEdit =>
            !!e &&
            typeof e === 'object' &&
            typeof (e as PatchEdit).cardId === 'string' &&
            typeof (e as PatchEdit).text === 'string'
        )
      : [],
    adds: Array.isArray(o.adds)
      ? o.adds.filter(
          (a): a is PatchAdd =>
            !!a &&
            typeof a === 'object' &&
            typeof (a as PatchAdd).id === 'string' &&
            ((a as PatchAdd).type === 'prompt' ||
              (a as PatchAdd).type === 'answer') &&
            typeof (a as PatchAdd).text === 'string' &&
            typeof (a as PatchAdd).packId === 'string'
        )
      : [],
  };
}

/** Apply edits + adds onto combined deck lists (mutates copies). */
export function applyPatchesToDeck(
  prompts: Card[],
  answers: Card[],
  packIds: string[],
  patches: DeckPatches | null | undefined
): { prompts: Card[]; answers: Card[] } {
  if (patchesAreEmpty(patches)) {
    return { prompts, answers };
  }
  const p = patches!;
  const editMap = new Map(p.edits.map((e) => [e.cardId, e]));

  const mapOne = (c: Card): Card => {
    const e = editMap.get(c.id);
    if (!e) return c;
    return {
      ...c,
      text: e.text,
      pick: typeof e.pick === 'number' ? e.pick : c.pick,
    };
  };

  let nextPrompts = prompts.map(mapOne);
  let nextAnswers = answers.map(mapOne);

  const selected = new Set(packIds.length ? packIds : ['core']);
  const seen = new Set([
    ...nextPrompts.map((c) => c.id),
    ...nextAnswers.map((c) => c.id),
  ]);

  for (const add of p.adds) {
    if (!selected.has(add.packId)) continue;
    if (seen.has(add.id)) continue;
    seen.add(add.id);
    const card: Card = {
      id: add.id,
      type: add.type,
      text: add.text,
      pick: add.type === 'prompt' ? Math.max(1, add.pick || 1) : 1,
      sourcePack: add.packId,
    };
    if (add.type === 'prompt') nextPrompts = [...nextPrompts, card];
    else nextAnswers = [...nextAnswers, card];
  }

  return { prompts: nextPrompts, answers: nextAnswers };
}

/** Remap a single live card (hand / prompt) from current patches. */
export function applyEditToCard(
  card: Card,
  patches: DeckPatches | null | undefined
): Card {
  if (!patches) return card;
  const e = patches.edits.find((x) => x.cardId === card.id);
  if (!e) return card;
  return {
    ...card,
    text: e.text,
    pick: typeof e.pick === 'number' ? e.pick : card.pick,
  };
}

export function newAdminCardId(type: CardType): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `admin-${type}-${Date.now().toString(36)}-${r}`;
}

export function exportPatchesJson(patches: DeckPatches): string {
  const payload = {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    note:
      'Parches locales Guerrilla Cards. Aplica edits por id en deck/packs; inserts adds en el pack indicado.',
    edits: patches.edits,
    adds: patches.adds,
    byPack: groupAddsByPack(patches),
  };
  return JSON.stringify(payload, null, 2);
}

function groupAddsByPack(patches: DeckPatches): Record<string, PatchAdd[]> {
  const out: Record<string, PatchAdd[]> = {};
  for (const a of patches.adds) {
    (out[a.packId] ??= []).push(a);
  }
  return out;
}
