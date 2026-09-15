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
import * as Engine from '../engine/game';
import {
  buildPreShuffledAnswerDeck,
  buildVariedPromptDeck,
  loadCombinedDeck,
} from '../engine/deck';
import {
  coerceGameState,
  type GameMode,
  type GameState,
  type JudgeMode,
} from '../engine/types';
import { gameProgress } from '../engine/syncProgress';
import {
  getMySeat,
  getMySeatSync,
  mergeHandsPreserveLocal,
  pushRoom,
} from './roomSync';

const STORAGE_KEY = 'guerrilla_cards_games_v1';
const RECENT_PROMPTS_KEY = 'guerrilla_cards_recent_prompts_v1';
const RECENT_ANSWERS_KEY = 'guerrilla_cards_recent_answers_v1';
const RECENT_MAX = 120;
const EMPTY_DECK: import('../engine/types').Card[] = [];

/**
 * Avoid list for a NEW match: only the newest browser recents.
 * Do not merge every live game's usedPromptIds — that sank almost the whole
 * deck after a few sessions and killed full-list entropy.
 */
function collectAvoidPromptIds(
  recent: string[],
  _games: GamesMap
): string[] {
  return recent.slice(0, RECENT_MAX);
}

async function loadRecentIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function pushRecentIds(key: string, ids: string[]) {
  if (!ids.length) return;
  const prev = await loadRecentIds(key);
  const next = [...ids, ...prev.filter((id) => !ids.includes(id))].slice(
    0,
    RECENT_MAX
  );
  await AsyncStorage.setItem(key, JSON.stringify(next));
}

function mergeRecentLocal(prev: string[], ids: string[]): string[] {
  if (!ids.length) return prev;
  return [...ids, ...prev.filter((id) => !ids.includes(id))].slice(0, RECENT_MAX);
}


type GamesMap = Record<string, GameState>;

function coerceMap(raw: GamesMap): GamesMap {
  const out: GamesMap = {};
  for (const [k, g] of Object.entries(raw)) {
    out[k] = coerceGameState(g);
  }
  return out;
}

interface GameContextValue {
  games: GamesMap;
  ready: boolean;
  createGame: (opts: {
    hostNickname: string;
    mode: GameMode;
    packIds: string[];
    targetScore?: number;
    judgeMode?: JudgeMode;
  }) => GameState;
  /** Solo: create host-only + start (rivals injected after submit) */
  createAndStartSolo: (opts: {
    hostNickname: string;
    packIds: string[];
    targetScore?: number;
    botCount?: number;
  }) => GameState;
  joinOrOpen: (code: string) => GameState | null;
  saveGame: (state: GameState, opts?: { sync?: boolean }) => void;
  updateGame: (code: string, updater: (g: GameState) => GameState) => void;
  deleteGame: (code: string) => void;
  getGame: (code: string) => GameState | undefined;
  /** Rematch in-place: same code + seats, scores 0, reshuffled decks, started. */
  restartSameSetup: (fromCode: string) => GameState | null;
  /** Replace local game if remote.updatedAt is newer (online poll). */
  applyRemoteGame: (state: GameState) => boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

async function loadAll(): Promise<GamesMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const map = coerceMap(JSON.parse(raw) as GamesMap);
    const hydrated: GamesMap = {};
    for (const [k, g] of Object.entries(map)) {
      hydrated[k] = hydrateDecks(g);
    }
    return hydrated;
  } catch {
    return {};
  }
}

/** Don't write full decks to disk — they're huge and made every tap lag. */
function slimForStorage(games: GamesMap): GamesMap {
  const out: GamesMap = {};
  for (const [k, g] of Object.entries(games)) {
    out[k] = {
      ...g,
      promptDeck: [],
      answerDeck: [],
    };
  }
  return out;
}

function hydrateDecks(g: GameState): GameState {
  const needsPrompts = !(g.promptDeck && g.promptDeck.length);
  const needsAnswers = !(g.answerDeck && g.answerDeck.length);
  if (!needsPrompts && !needsAnswers) return g;

  const { prompts, answers } = loadCombinedDeck(g.packIds);
  let promptDeck = g.promptDeck ?? [];
  let answerDeck = g.answerDeck ?? [];

  if (needsPrompts) {
    const used = new Set(g.usedPromptIds ?? []);
    const unused = prompts.filter((p) => !used.has(p.id));
    // Same as nueva partida / reiniciar — shuffle once on hydrate
    promptDeck = buildVariedPromptDeck(
      unused.length ? unused : prompts,
      unused.length ? [] : (g.usedPromptIds ?? []).slice(-80)
    );
  }
  if (needsAnswers) {
    const inHands = new Set(
      (g.players ?? []).flatMap((p) => (p.hand ?? []).map((c) => c.id))
    );
    answerDeck = buildPreShuffledAnswerDeck(
      answers.filter((a) => !inHands.has(a.id)),
      [],
      3
    );
  }
  return { ...g, promptDeck, answerDeck };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPending: GamesMap | null = null;

async function persist(games: GamesMap) {
  // Debounce + slim payload so star / next round / discard stay snappy
  persistPending = games;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    const snapshot = persistPending;
    persistPending = null;
    persistTimer = null;
    if (!snapshot) return;
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(slimForStorage(snapshot))
      );
    } catch {
      // ignore quota / stringify errors — memory state is source of truth mid-match
    }
  }, 900);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [games, setGames] = useState<GamesMap>({});
  const [ready, setReady] = useState(false);
  const gamesRef = useRef<GamesMap>({});
  const recentPromptsRef = useRef<string[]>([]);
  const recentAnswersRef = useRef<string[]>([]);

  useEffect(() => {
    Promise.all([
      loadAll(),
      loadRecentIds(RECENT_PROMPTS_KEY),
      loadRecentIds(RECENT_ANSWERS_KEY),
    ]).then(([g, rp, ra]) => {
      gamesRef.current = g;
      // Merge live usedPromptIds into recents (covers first-prompt / old-build gaps)
      const fromGames: string[] = [];
      const seen = new Set(rp);
      for (const game of Object.values(g)) {
        for (const id of game.usedPromptIds ?? []) {
          if (seen.has(id)) continue;
          seen.add(id);
          fromGames.push(id);
        }
      }
      recentPromptsRef.current = mergeRecentLocal(rp, fromGames);
      if (fromGames.length) void pushRecentIds(RECENT_PROMPTS_KEY, fromGames);
      recentAnswersRef.current = ra;
      const forUi: GamesMap = {};
      for (const [k, game] of Object.entries(g)) {
        forUi[k] = { ...game, promptDeck: [], answerDeck: [] };
      }
      setGames(forUi);
      setReady(true);
    });
  }, []);

  const toUiGame = useCallback((g: GameState) => {
    return { ...g, promptDeck: EMPTY_DECK, answerDeck: EMPTY_DECK };
  }, []);

  const commit = useCallback((next: GamesMap) => {
    // Full decks live only in the ref — never put them in React state.
    gamesRef.current = next;
    const forUi: GamesMap = {};
    for (const [k, g] of Object.entries(next)) {
      forUi[k] = toUiGame(g);
    }
    setGames(forUi);
    void persist(forUi);
  }, [toUiGame]);

  const createGame = useCallback(
    (opts: {
      hostNickname: string;
      mode: GameMode;
      packIds: string[];
      targetScore?: number;
      judgeMode?: JudgeMode;
    }) => {
      // Sync-ish: start without avoid, then we still push recents on play.
      // Prefer reading cached recents from refs filled on boot.
      const state = Engine.createGame({
        ...opts,
        avoidPromptIds: collectAvoidPromptIds(
          recentPromptsRef.current,
          gamesRef.current
        ),
        avoidAnswerIds: recentAnswersRef.current,
      });
      commit({ ...gamesRef.current, [state.code]: state });
      // Async: caller awaits one pushRoom (avoids race with joiners)
      return state;
    },
    [commit]
  );

  const createAndStartSolo = useCallback(
    (opts: {
      hostNickname: string;
      packIds: string[];
      targetScore?: number;
      botCount?: number;
    }) => {
      let state = Engine.createSoloGame({
        ...opts,
        avoidPromptIds: collectAvoidPromptIds(
          recentPromptsRef.current,
          gamesRef.current
        ),
        avoidAnswerIds: recentAnswersRef.current,
      });
      state = Engine.startGame(state);
      // startGame already drew round-1 prompt — commit() alone never mirrored
      // it into recents (updateGame only diffs later ids). Remember now.
      const startedUsed = state.usedPromptIds ?? [];
      if (startedUsed.length) {
        recentPromptsRef.current = mergeRecentLocal(
          recentPromptsRef.current,
          startedUsed
        );
        void pushRecentIds(RECENT_PROMPTS_KEY, startedUsed);
      }
      commit({ ...gamesRef.current, [state.code]: state });
      return state;
    },
    [commit]
  );

  const joinOrOpen = useCallback((code: string) => {
    const key = code.trim().toUpperCase();
    const g = gamesRef.current[key];
    return g ? coerceGameState(g) : null;
  }, []);

  const saveGame = useCallback(
    (state: GameState, opts?: { sync?: boolean }) => {
      const sync = opts?.sync !== false;
      const next = {
        ...coerceGameState(state),
        updatedAt: Date.now(),
      };
      // Keep decks from incoming state when present
      if (state.promptDeck?.length) next.promptDeck = state.promptDeck;
      if (state.answerDeck?.length) next.answerDeck = state.answerDeck;
      const hydrated = hydrateDecks(next);
      commit({
        ...gamesRef.current,
        [hydrated.code]: hydrated,
      });
      // Join path uses sync:false — avoid racing a pre-seat push that wipes identity
      if (sync && hydrated.mode === 'async') {
        void (async () => {
          const seat = await getMySeat(hydrated.code);
          await pushRoom(hydrated, seat);
        })();
      }
    },
    [commit]
  );

  const applyRemoteGame = useCallback(
    (state: GameState) => {
      const key = state.code.trim().toUpperCase();
      let remote = hydrateDecks(coerceGameState({ ...state, code: key }));
      const local = gamesRef.current[key];
      const localProg = gameProgress(local);
      const remoteProg = gameProgress(remote);
      // Progress is round-aware: reveal → next submitting is forward, not a downgrade
      const remoteAdvanced = remoteProg > localProg;
      // Rematch from results drops progress; trust newer updatedAt
      const isMatchRestart =
        !!local &&
        local.phase === 'results' &&
        remote.phase !== 'results' &&
        (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0);
      // Keep local if we already moved to the next cycle and remote is stale reveal
      if (local && localProg > remoteProg && !isMatchRestart) {
        return false;
      }
      if (
        local &&
        !remoteAdvanced &&
        (local.updatedAt ?? 0) > (remote.updatedAt ?? 0)
      ) {
        return false;
      }
      if (
        local &&
        !remoteAdvanced &&
        (local.updatedAt ?? 0) === (remote.updatedAt ?? 0) &&
        local.phase === remote.phase &&
        (local.submissions?.length ?? 0) >= (remote.submissions?.length ?? 0)
      ) {
        return false;
      }
      const seat = getMySeatSync(key);
      remote = mergeHandsPreserveLocal(remote, local, seat);
      // Same discarding round: union who already discarded (sync must not wipe peers)
      if (
        local &&
        remote.phase === 'discarding' &&
        local.phase === 'discarding' &&
        (local.round ?? 0) === (remote.round ?? 0)
      ) {
        const ids = Array.from(
          new Set([
            ...(local.discardDonePlayerIds ?? []),
            ...(remote.discardDonePlayerIds ?? []),
          ])
        );
        const byDiscard = new Map<
          string,
          NonNullable<typeof remote.lastDiscarded>[number]
        >();
        for (const row of [
          ...(local.lastDiscarded ?? []),
          ...(remote.lastDiscarded ?? []),
        ]) {
          if (row?.playerId) byDiscard.set(row.playerId, row);
        }
        remote = {
          ...remote,
          discardDonePlayerIds: ids,
          lastDiscarded: Array.from(byDiscard.values()),
        };
      }
      // Only re-attach OUR in-progress answer for THIS submitting round+prompt.
      // Never re-inject peers' (or prior-round) answers — that left 2/3 stuck
      // as «ya contestaste» after Zar advanced.
      if (
        local?.submissions?.length &&
        remote.phase === 'submitting' &&
        local.phase === 'submitting' &&
        (local.round ?? 0) === (remote.round ?? 0) &&
        (local.currentPrompt?.id ?? null) === (remote.currentPrompt?.id ?? null) &&
        seat
      ) {
        const localMine = local.submissions.find(
          (s) => s.playerId === seat && !s.rival
        );
        const remoteRound = remote.round;
        const remoteSubs = (remote.submissions ?? []).filter(
          (s) => s.round == null || s.round === remoteRound
        );
        if (
          localMine &&
          (localMine.round == null || localMine.round === remoteRound) &&
          !remoteSubs.some((s) => s.playerId === seat)
        ) {
          remote = {
            ...remote,
            submissions: [...remoteSubs, { ...localMine, round: remoteRound }],
          };
        } else {
          remote = { ...remote, submissions: remoteSubs };
        }
      } else if (remote.phase === 'submitting') {
        const remoteRound = remote.round;
        remote = {
          ...remote,
          submissions: (remote.submissions ?? []).filter(
            (s) => s.round == null || s.round === remoteRound
          ),
        };
      }
      if (remote.phase === 'submitting') {
        remote = Engine.advanceToJudgingIfReady(remote);
      }
      gamesRef.current = { ...gamesRef.current, [key]: remote };
      setGames((prevMap) => ({
        ...prevMap,
        [key]: toUiGame(remote),
      }));
      void persist({ ...gamesRef.current, [key]: toUiGame(remote) });
      // If we just promoted, push so Zar / others see judging
      if (
        remote.mode === 'async' &&
        remote.phase === 'judging' &&
        local?.phase === 'submitting'
      ) {
        void pushRoom(remote, seat);
      }
      return true;
    },
    [toUiGame]
  );

  const updateGame = useCallback(
    (code: string, updater: (g: GameState) => GameState) => {
      const cur = gamesRef.current[code];
      if (!cur) return;
      // Skip double coerce — ref state is already live
      const prev = cur;
      let next = { ...updater(prev), updatedAt: Date.now() };
      next = Engine.advanceToJudgingIfReady(next);
      gamesRef.current = { ...gamesRef.current, [code]: next };
      // Single-key React update (not rebuilding every game)
      setGames((prevMap) => ({
        ...prevMap,
        [code]: toUiGame(next),
      }));
      void persist({ ...gamesRef.current, [code]: toUiGame(next) });

      if (next.mode === 'async') {
        void (async () => {
          const seat = await getMySeat(code);
          const r = await pushRoom(next, seat);
          if (r.ok && r.skipped && r.state) {
            const key = r.state.code.trim().toUpperCase();
            let remote = hydrateDecks(
              coerceGameState({ ...r.state, code: key })
            );
            const local = gamesRef.current[key];
            if (local && gameProgress(local) > gameProgress(remote)) {
              return;
            }
            if (local && (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0)) {
              return;
            }
            remote = mergeHandsPreserveLocal(
              remote,
              local,
              seat ?? getMySeatSync(key)
            );
            gamesRef.current = { ...gamesRef.current, [key]: remote };
            setGames((prevMap) => ({
              ...prevMap,
              [key]: toUiGame(remote),
            }));
            void persist({ ...gamesRef.current, [key]: toUiGame(remote) });
          }
        })();
      }

      // Recents off the tap path — never block the frame
      setTimeout(() => {
        const prevUsed = new Set(prev.usedPromptIds ?? []);
        const newPrompts = (next.usedPromptIds ?? []).filter(
          (id) => !prevUsed.has(id)
        );
        if (newPrompts.length) {
          recentPromptsRef.current = [
            ...newPrompts,
            ...recentPromptsRef.current.filter((id) => !newPrompts.includes(id)),
          ].slice(0, RECENT_MAX);
          void pushRecentIds(RECENT_PROMPTS_KEY, newPrompts);
        }
        const playedAnswers = next.submissions
          .flatMap((s) => s.cards.map((c) => c.id))
          .filter(Boolean);
        const prevPlayed = new Set(
          prev.submissions.flatMap((s) => s.cards.map((c) => c.id))
        );
        const newAnswers = playedAnswers.filter((id) => !prevPlayed.has(id));
        if (newAnswers.length) {
          recentAnswersRef.current = [
            ...newAnswers,
            ...recentAnswersRef.current.filter((id) => !newAnswers.includes(id)),
          ].slice(0, RECENT_MAX);
          void pushRecentIds(RECENT_ANSWERS_KEY, newAnswers);
        }
      }, 0);
    },
    [toUiGame]
  );

  const deleteGame = useCallback(
    (code: string) => {
      const next = { ...gamesRef.current };
      delete next[code];
      commit(next);
    },
    [commit]
  );

  const getGame = useCallback(
    (code: string) => {
      const g = gamesRef.current[code];
      return g ? coerceGameState(g) : undefined;
    },
    [games] // re-render when ui map changes; data read from ref (with decks)
  );

  const restartSameSetup = useCallback(
    (fromCode: string): GameState | null => {
      const key = fromCode.trim().toUpperCase();
      const raw = gamesRef.current[key];
      if (!raw) return null;
      const old = coerceGameState(raw);
      if (!old.players.length) return null;

      // Fold this match's used prompts into recents before reshuffling
      const oldUsed = old.usedPromptIds ?? [];
      if (oldUsed.length) {
        recentPromptsRef.current = [
          ...oldUsed,
          ...recentPromptsRef.current.filter((id) => !oldUsed.includes(id)),
        ].slice(0, RECENT_MAX);
        void pushRecentIds(RECENT_PROMPTS_KEY, oldUsed);
      }

      const others = { ...gamesRef.current };
      delete others[key];
      const state = Engine.restartMatch(old, {
        avoidPromptIds: collectAvoidPromptIds(
          recentPromptsRef.current,
          others
        ),
        avoidAnswerIds: recentAnswersRef.current,
      });
      // Keep same code/key; bump updatedAt so online peers accept rematch
      const stamped = { ...state, code: key, updatedAt: Date.now() };
      const nextMap = { ...gamesRef.current, [key]: stamped };
      commit(nextMap);
      if (stamped.mode === 'async') {
        void (async () => {
          const seat = await getMySeat(key);
          await pushRoom(stamped, seat);
        })();
      }
      return stamped;
    },
    [commit]
  );

  const value = useMemo(
    () => ({
      games,
      ready,
      createGame,
      createAndStartSolo,
      joinOrOpen,
      saveGame,
      updateGame,
      deleteGame,
      getGame,
      restartSameSetup,
      applyRemoteGame,
    }),
    [
      games,
      ready,
      createGame,
      createAndStartSolo,
      joinOrOpen,
      saveGame,
      updateGame,
      deleteGame,
      getGame,
      restartSameSetup,
      applyRemoteGame,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameStore() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameStore debe usarse dentro de GameProvider');
  return ctx;
}
