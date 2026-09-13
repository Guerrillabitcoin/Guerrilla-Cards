import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { setActiveDeckPatches } from '../engine/deck';
import {
  EMPTY_PATCHES,
  exportPatchesJson,
  newAdminCardId,
  normalizePatches,
  patchesAreEmpty,
  type DeckPatches,
  type PatchAdd,
  type PatchEdit,
} from '../engine/patches';
import type { Card, CardType } from '../engine/types';

const UNLOCKED_KEY = 'guerrilla_admin_unlocked_v1';
const PATCHES_KEY = 'guerrilla_deck_patches_v1';

/** Simple shared PIN — change here if you want. Not shown in public UI. */
export const ADMIN_PIN = 'guerrilla';

type AdminContextValue = {
  ready: boolean;
  unlocked: boolean;
  patches: DeckPatches;
  patchCount: number;
  unlock: (pin: string) => boolean;
  lock: () => void;
  editCard: (cardId: string, text: string, pick?: number) => void;
  removeEdit: (cardId: string) => void;
  addCard: (opts: {
    type: CardType;
    text: string;
    pick?: number;
    packId: string;
  }) => PatchAdd;
  removeAdd: (id: string) => void;
  clearAllPatches: () => void;
  getExportJson: () => string;
  findEdit: (cardId: string) => PatchEdit | undefined;
};

const AdminContext = createContext<AdminContextValue | null>(null);

function readAdminQuery(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('admin') === '1' || q.get('admin') === 'true';
  } catch {
    return false;
  }
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [patches, setPatches] = useState<DeckPatches>({
    ...EMPTY_PATCHES,
    edits: [],
    adds: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, raw] = await Promise.all([
          AsyncStorage.getItem(UNLOCKED_KEY),
          AsyncStorage.getItem(PATCHES_KEY),
        ]);
        if (cancelled) return;
        let nextUnlocked = u === '1';
        if (readAdminQuery()) nextUnlocked = true;
        setUnlocked(nextUnlocked);
        if (nextUnlocked) void AsyncStorage.setItem(UNLOCKED_KEY, '1');
        const parsed = normalizePatches(raw ? JSON.parse(raw) : null);
        setPatches(parsed);
        setActiveDeckPatches(parsed);
      } catch {
        if (!cancelled) {
          setActiveDeckPatches(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistPatches = useCallback((next: DeckPatches) => {
    setPatches(next);
    setActiveDeckPatches(next);
    void AsyncStorage.setItem(PATCHES_KEY, JSON.stringify(next));
  }, []);

  const unlock = useCallback((pin: string) => {
    if (pin.trim() !== ADMIN_PIN) return false;
    setUnlocked(true);
    void AsyncStorage.setItem(UNLOCKED_KEY, '1');
    return true;
  }, []);

  const lock = useCallback(() => {
    setUnlocked(false);
    void AsyncStorage.setItem(UNLOCKED_KEY, '0');
  }, []);

  const editCard = useCallback(
    (cardId: string, text: string, pick?: number) => {
      const trimmed = text.trim();
      if (!cardId || !trimmed) return;
      setPatches((cur) => {
        const rest = cur.edits.filter((e) => e.cardId !== cardId);
        // Also update matching add if editing a newly added card
        const adds = cur.adds.map((a) =>
          a.id === cardId
            ? {
                ...a,
                text: trimmed,
                pick: typeof pick === 'number' ? pick : a.pick,
              }
            : a
        );
        const next: DeckPatches = {
          version: 1,
          edits: [
            ...rest,
            {
              cardId,
              text: trimmed,
              ...(typeof pick === 'number' ? { pick } : {}),
            },
          ],
          adds,
        };
        setActiveDeckPatches(next);
        void AsyncStorage.setItem(PATCHES_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const removeEdit = useCallback((cardId: string) => {
    setPatches((cur) => {
      const next: DeckPatches = {
        ...cur,
        edits: cur.edits.filter((e) => e.cardId !== cardId),
      };
      setActiveDeckPatches(next);
      void AsyncStorage.setItem(PATCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addCard = useCallback(
    (opts: {
      type: CardType;
      text: string;
      pick?: number;
      packId: string;
    }): PatchAdd => {
      const add: PatchAdd = {
        id: newAdminCardId(opts.type),
        type: opts.type,
        text: opts.text.trim(),
        pick:
          opts.type === 'prompt' ? Math.max(1, opts.pick ?? 1) : 1,
        packId: opts.packId,
      };
      setPatches((cur) => {
        const next: DeckPatches = {
          version: 1,
          edits: cur.edits,
          adds: [...cur.adds, add],
        };
        setActiveDeckPatches(next);
        void AsyncStorage.setItem(PATCHES_KEY, JSON.stringify(next));
        return next;
      });
      return add;
    },
    []
  );

  const removeAdd = useCallback((id: string) => {
    setPatches((cur) => {
      const next: DeckPatches = {
        ...cur,
        adds: cur.adds.filter((a) => a.id !== id),
        edits: cur.edits.filter((e) => e.cardId !== id),
      };
      setActiveDeckPatches(next);
      void AsyncStorage.setItem(PATCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAllPatches = useCallback(() => {
    const next = { ...EMPTY_PATCHES, edits: [], adds: [] };
    persistPatches(next);
  }, [persistPatches]);

  const getExportJson = useCallback(() => exportPatchesJson(patches), [patches]);

  const findEdit = useCallback(
    (cardId: string) => patches.edits.find((e) => e.cardId === cardId),
    [patches.edits]
  );

  const patchCount = patches.edits.length + patches.adds.length;

  const value = useMemo<AdminContextValue>(
    () => ({
      ready,
      unlocked,
      patches,
      patchCount,
      unlock,
      lock,
      editCard,
      removeEdit,
      addCard,
      removeAdd,
      clearAllPatches,
      getExportJson,
      findEdit,
    }),
    [
      ready,
      unlocked,
      patches,
      patchCount,
      unlock,
      lock,
      editCard,
      removeEdit,
      addCard,
      removeAdd,
      clearAllPatches,
      getExportJson,
      findEdit,
    ]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    return {
      ready: false,
      unlocked: false,
      patches: { ...EMPTY_PATCHES, edits: [], adds: [] },
      patchCount: 0,
      unlock: () => false,
      lock: () => {},
      editCard: () => {},
      removeEdit: () => {},
      addCard: () => ({
        id: '',
        type: 'answer',
        text: '',
        pick: 1,
        packId: 'core',
      }),
      removeAdd: () => {},
      clearAllPatches: () => {},
      getExportJson: () => '{}',
      findEdit: () => undefined,
    };
  }
  return ctx;
}

/** Map live game cards through current patches (for instant UI). */
export function remapGameCards<T extends { currentPrompt: Card | null; players: { hand: Card[] }[]; promptDeck: Card[]; answerDeck: Card[]; submissions: { cards: Card[] }[] }>(
  game: T,
  patches: DeckPatches
): T {
  if (patchesAreEmpty(patches)) return game;
  const editMap = new Map(patches.edits.map((e) => [e.cardId, e]));
  const mapC = (c: Card): Card => {
    const e = editMap.get(c.id);
    if (!e) return c;
    return {
      ...c,
      text: e.text,
      pick: typeof e.pick === 'number' ? e.pick : c.pick,
    };
  };
  return {
    ...game,
    currentPrompt: game.currentPrompt ? mapC(game.currentPrompt) : null,
    players: game.players.map((p) => ({
      ...p,
      hand: (p.hand ?? []).map(mapC),
    })),
    promptDeck: (game.promptDeck ?? []).map(mapC),
    answerDeck: (game.answerDeck ?? []).map(mapC),
    submissions: (game.submissions ?? []).map((s) => ({
      ...s,
      cards: (s.cards ?? []).map(mapC),
    })),
  };
}
