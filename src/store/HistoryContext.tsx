import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CardStat,
  CardStatView,
  DiscardStat,
  FavoriteAnswer,
  WinningHistoryItem,
} from '../engine/types';

const HISTORY_KEY = 'guerrilla_cards_winning_history_v1';
const FAV_ANSWERS_KEY = 'guerrilla_cards_fav_answers_v1';
const DISCARD_STATS_KEY = 'guerrilla_cards_discard_stats_v1';
const CARD_STATS_KEY = 'guerrilla_cards_card_stats_v1';

type CardKind = 'answer' | 'prompt';

type CardRef = { id: string; text: string; kind?: CardKind };

interface HistoryContextValue {
  ready: boolean;
  winningHistory: WinningHistoryItem[];
  favoriteAnswers: FavoriteAnswer[];
  discardStats: DiscardStat[];
  cardStats: CardStat[];
  appendWinner: (item: Omit<WinningHistoryItem, 'id' | 'createdAt' | 'favorite'> & {
    id?: string;
    createdAt?: number;
    favorite?: boolean;
  }) => Promise<WinningHistoryItem>;
  toggleFavorite: (id: string) => void;
  deleteHistoryItem: (id: string) => void;
  addFavoriteAnswer: (
    text: string,
    meta?: { promptText?: string; answers?: string[] }
  ) => void;
  deleteFavoriteAnswer: (id: string) => void;
  favorites: WinningHistoryItem[];
  recordDiscards: (cards: { id: string; text: string }[]) => void;
  topDiscarded: (limit?: number) => DiscardStat[];
  recordDrawn: (cards: CardRef[]) => void;
  recordPlayed: (cards: CardRef[], opts?: { won?: boolean }) => void;
  recordDiscarded: (cards: CardRef[]) => void;
  recordUnmarkedForcedDiscard: (cards: CardRef[]) => void;
  recordLeftInHand: (cards: CardRef[]) => void;
  recordFavoriteMark: (cardId: string, text?: string) => void;
  listCardStats: (opts?: {
    minDrawn?: number;
    sort?: 'problem' | 'discard' | 'stale' | 'wins';
  }) => CardStatView[];
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function emptyStat(cardId: string, text: string, kind: CardKind): CardStat {
  return {
    cardId,
    text,
    kind,
    timesDrawn: 0,
    timesPlayed: 0,
    timesDiscarded: 0,
    timesUnmarkedForcedDiscard: 0,
    timesLeftInHandAtEnd: 0,
    totalHoldMs: 0,
    wins: 0,
    favoriteMarks: 0,
  };
}

function toView(s: CardStat): CardStatView {
  const drawn = s.timesDrawn;
  const played = s.timesPlayed;
  const denomHold =
    s.timesPlayed + s.timesDiscarded + s.timesLeftInHandAtEnd;
  const playRate = drawn > 0 ? played / drawn : 0;
  const discardRate = drawn > 0 ? s.timesDiscarded / drawn : 0;
  const staleRate = drawn > 0 ? s.timesLeftInHandAtEnd / drawn : 0;
  const winRate = played > 0 ? s.wins / played : 0;
  const avgHoldMs = denomHold > 0 ? s.totalHoldMs / denomHold : 0;
  const problemScore =
    staleRate * 0.45 + discardRate * 0.4 + (1 - playRate) * 0.15;
  return {
    ...s,
    playRate,
    discardRate,
    staleRate,
    winRate,
    avgHoldMs,
    problemScore,
  };
}

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [winningHistory, setWinningHistory] = useState<WinningHistoryItem[]>([]);
  const [favoriteAnswers, setFavoriteAnswers] = useState<FavoriteAnswer[]>([]);
  const [discardStats, setDiscardStats] = useState<DiscardStat[]>([]);
  const [cardStats, setCardStats] = useState<CardStat[]>([]);
  const [ready, setReady] = useState(false);
  const historyRef = useRef<WinningHistoryItem[]>([]);
  const favAnswersRef = useRef<FavoriteAnswer[]>([]);
  const discardStatsRef = useRef<DiscardStat[]>([]);
  const cardStatsRef = useRef<CardStat[]>([]);
  /** Active hold start times keyed by cardId */
  const holdStartedAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      loadJson<WinningHistoryItem[]>(HISTORY_KEY, []),
      loadJson<FavoriteAnswer[]>(FAV_ANSWERS_KEY, []),
      loadJson<DiscardStat[]>(DISCARD_STATS_KEY, []),
      loadJson<CardStat[]>(CARD_STATS_KEY, []),
    ]).then(([h, f, d, cs]) => {
      historyRef.current = h;
      favAnswersRef.current = f;
      discardStatsRef.current = d;
      const coerced = cs.map((s) => ({
        ...emptyStat(s.cardId, s.text, s.kind),
        ...s,
        timesUnmarkedForcedDiscard: s.timesUnmarkedForcedDiscard ?? 0,
      }));
      cardStatsRef.current = coerced;
      setWinningHistory(h);
      setFavoriteAnswers(f);
      setDiscardStats(d);
      setCardStats(coerced);
      setReady(true);
    });
  }, []);

  const persistHistory = useCallback(async (items: WinningHistoryItem[]) => {
    historyRef.current = items;
    setWinningHistory(items);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }, []);

  const persistFavAnswers = useCallback(async (items: FavoriteAnswer[]) => {
    favAnswersRef.current = items;
    setFavoriteAnswers(items);
    await AsyncStorage.setItem(FAV_ANSWERS_KEY, JSON.stringify(items));
  }, []);

  const persistDiscardStats = useCallback(async (items: DiscardStat[]) => {
    discardStatsRef.current = items;
    setDiscardStats(items);
    await AsyncStorage.setItem(DISCARD_STATS_KEY, JSON.stringify(items));
  }, []);

  const persistCardStats = useCallback(async (items: CardStat[]) => {
    cardStatsRef.current = items;
    setCardStats(items);
    await AsyncStorage.setItem(CARD_STATS_KEY, JSON.stringify(items));
  }, []);

  const mutateCardStats = useCallback(
    (mutator: (byId: Map<string, CardStat>) => void) => {
      const byId = new Map<string, CardStat>();
      for (const s of cardStatsRef.current) {
        byId.set(s.cardId, {
          ...s,
          timesUnmarkedForcedDiscard: s.timesUnmarkedForcedDiscard ?? 0,
        });
      }
      mutator(byId);
      void persistCardStats(Array.from(byId.values()));
    },
    [persistCardStats]
  );

  const ensureInMap = (
    byId: Map<string, CardStat>,
    cardId: string,
    text: string,
    kind: CardKind
  ): CardStat => {
    let s = byId.get(cardId);
    if (!s) {
      s = emptyStat(cardId, text, kind);
      byId.set(cardId, s);
    } else {
      if (text) s.text = text;
      if (kind) s.kind = kind;
    }
    return s;
  };

  const takeHoldMs = (cardId: string): number => {
    const started = holdStartedAtRef.current[cardId];
    if (started == null) return 0;
    delete holdStartedAtRef.current[cardId];
    return Math.max(0, Date.now() - started);
  };

  const appendWinner = useCallback(
    async (
      item: Omit<WinningHistoryItem, 'id' | 'createdAt' | 'favorite'> & {
        id?: string;
        createdAt?: number;
        favorite?: boolean;
      }
    ) => {
      const entry: WinningHistoryItem = {
        id: item.id ?? uid('win'),
        promptText: item.promptText,
        answers: item.answers,
        filledText: item.filledText,
        packs: item.packs,
        createdAt: item.createdAt ?? Date.now(),
        favorite: item.favorite ?? false,
        gameCode: item.gameCode,
        round: item.round,
      };
      const next = [entry, ...historyRef.current].slice(0, 200);
      await persistHistory(next);
      return entry;
    },
    [persistHistory]
  );

  const bumpFavoriteByText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      mutateCardStats((byId) => {
        let matched = false;
        for (const s of byId.values()) {
          if (s.text === t && s.kind === 'answer') {
            s.favoriteMarks += 1;
            matched = true;
          }
        }
        if (!matched) {
          // No known card id — skip creating orphan stats without draws
        }
      });
    },
    [mutateCardStats]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const item = historyRef.current.find((h) => h.id === id);
      const turningOn = item ? !item.favorite : false;
      const next = historyRef.current.map((h) =>
        h.id === id ? { ...h, favorite: !h.favorite } : h
      );
      void persistHistory(next);
      if (turningOn && item) {
        for (const ans of item.answers) {
          bumpFavoriteByText(ans);
        }
      } else if (!turningOn && item) {
        // Unmark ★ → remove from Favoritas (answer list too)
        const filled = item.filledText?.trim();
        if (filled) {
          void persistFavAnswers(
            favAnswersRef.current.filter((a) => a.text.trim() !== filled)
          );
        }
      }
    },
    [persistHistory, bumpFavoriteByText, persistFavAnswers]
  );

  const deleteHistoryItem = useCallback(
    (id: string) => {
      const next = historyRef.current.filter((h) => h.id !== id);
      void persistHistory(next);
    },
    [persistHistory]
  );

  const addFavoriteAnswer = useCallback(
    (
      text: string,
      meta?: { promptText?: string; answers?: string[] }
    ) => {
      const t = text.trim();
      if (!t) return;
      const existing = favAnswersRef.current.find((a) => a.text === t);
      if (existing) {
        // Upgrade legacy entries that only had plain text
        if (
          meta?.promptText &&
          (!existing.promptText || existing.promptText === '______')
        ) {
          const upgraded: FavoriteAnswer = {
            ...existing,
            promptText: meta.promptText,
            answers: meta.answers?.length ? meta.answers : existing.answers,
          };
          void persistFavAnswers(
            favAnswersRef.current.map((a) =>
              a.id === existing.id ? upgraded : a
            )
          );
        }
        return;
      }
      const entry: FavoriteAnswer = {
        id: uid('ans'),
        text: t,
        createdAt: Date.now(),
        promptText: meta?.promptText?.trim() || undefined,
        answers: meta?.answers?.filter(Boolean),
      };
      void persistFavAnswers([entry, ...favAnswersRef.current].slice(0, 100));
      bumpFavoriteByText(t);
    },
    [persistFavAnswers, bumpFavoriteByText]
  );

  const deleteFavoriteAnswer = useCallback(
    (id: string) => {
      const removed = favAnswersRef.current.find((a) => a.id === id);
      void persistFavAnswers(favAnswersRef.current.filter((a) => a.id !== id));
      // Unmark matching history ★ so it leaves Favoritas everywhere
      if (removed) {
        const text = removed.text.trim();
        const next = historyRef.current.map((h) =>
          h.filledText?.trim() === text ? { ...h, favorite: false } : h
        );
        void persistHistory(next);
      }
    },
    [persistFavAnswers, persistHistory]
  );

  const recordDiscards = useCallback(
    (cards: { id: string; text: string }[]) => {
      if (!cards.length) return;
      const byKey = new Map<string, DiscardStat>();
      for (const s of discardStatsRef.current) {
        byKey.set(s.id || s.text, { ...s });
      }
      for (const c of cards) {
        const key = c.id || c.text;
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
          if (!existing.text && c.text) existing.text = c.text;
        } else {
          byKey.set(key, { id: c.id || key, text: c.text, count: 1 });
        }
      }
      void persistDiscardStats(Array.from(byKey.values()));
    },
    [persistDiscardStats]
  );

  const topDiscarded = useCallback(
    (limit = 20): DiscardStat[] => {
      return [...discardStatsRef.current]
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
        .slice(0, limit);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [discardStats]
  );

  const recordDrawn = useCallback(
    (cards: CardRef[]) => {
      if (!cards.length) return;
      const now = Date.now();
      mutateCardStats((byId) => {
        for (const c of cards) {
          if (!c.id) continue;
          const kind: CardKind = c.kind ?? 'answer';
          const s = ensureInMap(byId, c.id, c.text, kind);
          // Only count a new draw if not already holding this instance
          if (holdStartedAtRef.current[c.id] == null) {
            s.timesDrawn += 1;
            holdStartedAtRef.current[c.id] = now;
          } else if (c.text) {
            s.text = c.text;
          }
        }
      });
    },
    [mutateCardStats]
  );

  const recordPlayed = useCallback(
    (cards: CardRef[], opts?: { won?: boolean }) => {
      if (!cards.length) return;
      mutateCardStats((byId) => {
        for (const c of cards) {
          if (!c.id) continue;
          const kind: CardKind = c.kind ?? 'answer';
          const s = ensureInMap(byId, c.id, c.text, kind);
          const wasHolding = holdStartedAtRef.current[c.id] != null;
          const holdMs = takeHoldMs(c.id);
          // Closing an active hold = play disposition; late {won:true} only bumps wins
          if (wasHolding) {
            s.timesPlayed += 1;
            s.totalHoldMs += holdMs;
          }
          if (opts?.won) {
            s.wins += 1;
          }
        }
      });
    },
    [mutateCardStats]
  );

  const recordDiscarded = useCallback(
    (cards: CardRef[]) => {
      if (!cards.length) return;
      mutateCardStats((byId) => {
        for (const c of cards) {
          if (!c.id) continue;
          const kind: CardKind = c.kind ?? 'answer';
          const s = ensureInMap(byId, c.id, c.text, kind);
          const holdMs = takeHoldMs(c.id);
          s.timesDiscarded += 1;
          s.totalHoldMs += holdMs;
        }
      });
    },
    [mutateCardStats]
  );

  const recordUnmarkedForcedDiscard = useCallback(
    (cards: CardRef[]) => {
      if (!cards.length) return;
      mutateCardStats((byId) => {
        for (const c of cards) {
          if (!c.id) continue;
          const kind: CardKind = c.kind ?? 'answer';
          const s = ensureInMap(byId, c.id, c.text, kind);
          s.timesUnmarkedForcedDiscard =
            (s.timesUnmarkedForcedDiscard ?? 0) + 1;
        }
      });
    },
    [mutateCardStats]
  );

  const recordLeftInHand = useCallback(
    (cards: CardRef[]) => {
      if (!cards.length) return;
      mutateCardStats((byId) => {
        for (const c of cards) {
          if (!c.id) continue;
          const kind: CardKind = c.kind ?? 'answer';
          const s = ensureInMap(byId, c.id, c.text, kind);
          // Caller ensures once per match; only dispose if still holding
          if (holdStartedAtRef.current[c.id] == null) continue;
          const holdMs = takeHoldMs(c.id);
          s.timesLeftInHandAtEnd += 1;
          s.totalHoldMs += holdMs;
        }
      });
    },
    [mutateCardStats]
  );

  const recordFavoriteMark = useCallback(
    (cardId: string, text?: string) => {
      if (!cardId) return;
      mutateCardStats((byId) => {
        const s = ensureInMap(byId, cardId, text ?? '', 'answer');
        if (text) s.text = text;
        s.favoriteMarks += 1;
      });
    },
    [mutateCardStats]
  );

  const listCardStats = useCallback(
    (opts?: {
      minDrawn?: number;
      sort?: 'problem' | 'discard' | 'stale' | 'wins';
    }): CardStatView[] => {
      const minDrawn = opts?.minDrawn ?? 2;
      const sort = opts?.sort ?? 'problem';
      const views = cardStatsRef.current
        .filter((s) => s.timesDrawn >= minDrawn)
        .map(toView);
      views.sort((a, b) => {
        if (sort === 'discard') {
          return (
            b.discardRate - a.discardRate ||
            b.timesDiscarded - a.timesDiscarded ||
            a.text.localeCompare(b.text)
          );
        }
        if (sort === 'stale') {
          return (
            b.staleRate - a.staleRate ||
            b.timesLeftInHandAtEnd - a.timesLeftInHandAtEnd ||
            a.text.localeCompare(b.text)
          );
        }
        if (sort === 'wins') {
          return (
            b.winRate - a.winRate ||
            b.wins - a.wins ||
            a.text.localeCompare(b.text)
          );
        }
        // problem (default)
        return (
          b.problemScore - a.problemScore ||
          b.timesDrawn - a.timesDrawn ||
          a.text.localeCompare(b.text)
        );
      });
      return views;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardStats]
  );

  const favorites = useMemo(
    () => winningHistory.filter((h) => h.favorite),
    [winningHistory]
  );

  const value = useMemo(
    () => ({
      ready,
      winningHistory,
      favoriteAnswers,
      discardStats,
      cardStats,
      appendWinner,
      toggleFavorite,
      deleteHistoryItem,
      addFavoriteAnswer,
      deleteFavoriteAnswer,
      favorites,
      recordDiscards,
      topDiscarded,
      recordDrawn,
      recordPlayed,
      recordDiscarded,
      recordUnmarkedForcedDiscard,
      recordLeftInHand,
      recordFavoriteMark,
      listCardStats,
    }),
    [
      ready,
      winningHistory,
      favoriteAnswers,
      discardStats,
      cardStats,
      appendWinner,
      toggleFavorite,
      deleteHistoryItem,
      addFavoriteAnswer,
      deleteFavoriteAnswer,
      favorites,
      recordDiscards,
      topDiscarded,
      recordDrawn,
      recordPlayed,
      recordDiscarded,
      recordUnmarkedForcedDiscard,
      recordLeftInHand,
      recordFavoriteMark,
      listCardStats,
    ]
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}

export function useHistoryStore() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistoryStore debe usarse dentro de HistoryProvider');
  return ctx;
}
