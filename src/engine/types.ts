export type CardType = 'prompt' | 'answer';

export interface Card {
  id: string;
  type: CardType;
  text: string;
  pick: number;
  reason?: string;
  would_be_pack?: string;
  /** Pack id this copy was loaded from (for draw variety). */
  sourcePack?: string;
}

export interface PackMeta {
  id: string;
  title: string;
  description: string;
  nsfw: boolean;
  playable: boolean;
  counts: {
    total: number;
    prompts?: number;
    answers?: number;
  };
}

export interface PackFile {
  id: string;
  title: string;
  description: string;
  nsfw: boolean;
  playable?: boolean;
  cards: Card[];
  counts: PackMeta['counts'];
}

export type GameMode = 'async' | 'live' | 'solo';

export type JudgeMode = 'zar' | 'vote';

export type Phase =
  | 'lobby'
  | 'submitting'
  | 'judging'
  | 'reveal'
  | 'results'
  | 'discarding';

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  score: number;
  hand: Card[];
  /** Bot seat (solo mode) */
  isBot?: boolean;
}

export interface Submission {
  playerId: string;
  cards: Card[];
  /** Solo mode: random rival fill (not a real seat). */
  rival?: boolean;
  /** Round this answer belongs to — ignore if mismatched after nextRound sync. */
  round?: number;
}

export interface GameState {
  code: string;
  mode: GameMode;
  packIds: string[];
  players: Player[];
  phase: Phase;
  zarIndex: number;
  /** How the round winner is chosen: Zar picks, or everyone votes (no self). */
  judgeMode: JudgeMode;
  /** Vote mode: voterPlayerId → submissionPlayerId */
  votes?: Record<string, string>;
  currentPrompt: Card | null;
  submissions: Submission[];
  /** Shuffled order of submission indices for anonymous reveal */
  revealOrder: number[];
  roundWinnerId: string | null;
  /** Vote ties: all submission player ids that share the win (+1 each). */
  roundWinnerIds?: string[];
  targetScore: number;
  round: number;
  /** Whose phone seat is active (pass-and-play) */
  activeSeatId: string | null;
  usedPromptIds: string[];
  promptDeck: Card[];
  /** Cursor into promptDeck — never slice the pile between rounds */
  promptDeckPos: number;
  answerDeck: Card[];
  /** Cursor into answerDeck — avoid O(n) copies on every tap */
  answerDeckPos: number;
  createdAt: number;
  updatedAt: number;
  /** True after the one-time discard round (before round 5) has finished */
  discardRoundCompleted: boolean;
  /** Player ids that have already discarded in the current discarding phase */
  discardDonePlayerIds: string[];
  /** Cards discarded in the current discard round (per player) */
  lastDiscarded?: { playerId: string; cards: Card[] }[];
}

/** Winning round combo persisted in historial */
export interface WinningHistoryItem {
  id: string;
  promptText: string;
  answers: string[];
  filledText: string;
  packs?: string[];
  createdAt: number;
  favorite?: boolean;
  gameCode?: string;
  round?: number;
}

export interface FavoriteAnswer {
  id: string;
  /** Filled sentence (legacy + share fallback). */
  text: string;
  createdAt: number;
  /** Prompt with blanks — required for white/orange share format. */
  promptText?: string;
  /** Answer phrases that fill the blanks (orange). */
  answers?: string[];
}

/** Global most-discarded answer card ranking */
export interface DiscardStat {
  id: string;
  text: string;
  count: number;
}

export const HAND_SIZE = 12;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
/** Async lobby: exactly 4 seats to start (pass-and-play MVP). */
export const ASYNC_TARGET_PLAYERS = 4;
export const DEFAULT_TARGET_SCORE = 5;
/** Solo: máximo de rondas (luego results). */
export const SOLO_MAX_ROUNDS = 10;
/** Solo: meta por defecto (Puntacos). */
export const SOLO_DEFAULT_TARGET = 10;
export const SOLO_BOT_COUNT_DEFAULT = 2;
export const SOLO_BOT_COUNT_MAX = 3;
/** Random rival answers injected after you submit in solo. */
export const SOLO_RIVAL_COUNT = 3;

/** Discard phase before every round that is a multiple of this (5, 10, 15…). */
export const DISCARD_AT_ROUND = 5;
/**
 * True when round N should be preceded by a discard phase.
 * Solo: never before the final round (10) — only mid-match gates (e.g. 5).
 * Multi: every multiple of 5 including 10, 15…
 */
export function shouldDiscardBeforeRound(
  n: number,
  mode?: GameMode | string | null
): boolean {
  if (!(n > 0 && n % DISCARD_AT_ROUND === 0)) return false;
  if (mode === 'solo' && n >= SOLO_MAX_ROUNDS) return false;
  return true;
}
/** Min answer cards to discard in the discard phase */
export const DISCARD_MIN = 2;
/** Max answer cards to discard in the discard phase */
export const DISCARD_MAX = 5;
/** Alias of DISCARD_MIN (back-compat for solo skip / older call sites) */
export const DISCARD_COUNT = DISCARD_MIN;

export const BOT_NICKNAMES = [
  'Bot 1',
  'Bot 2',
  'IA Guerrilla',
  'Bot Guerrilla',
] as const;

/** Coerce older persisted games that lack discard fields */
export function coerceGameState(g: GameState): GameState {
  return {
    ...g,
    judgeMode: g.judgeMode ?? 'zar',
    votes: g.votes ?? {},
    roundWinnerIds: g.roundWinnerIds ?? [],
    discardRoundCompleted: g.discardRoundCompleted ?? false,
    discardDonePlayerIds: g.discardDonePlayerIds ?? [],
    lastDiscarded: g.lastDiscarded ?? [],
    usedPromptIds: g.usedPromptIds ?? [],
    promptDeck: g.promptDeck ?? [],
    promptDeckPos: g.promptDeckPos ?? 0,
    answerDeck: g.answerDeck ?? [],
    answerDeckPos: g.answerDeckPos ?? 0,
  };
}

/** Per-card telemetry (AsyncStorage guerrilla_cards_card_stats_v1) */
export interface CardStat {
  cardId: string;
  text: string;
  kind: 'answer' | 'prompt';
  timesDrawn: number;
  timesPlayed: number;
  timesDiscarded: number;
  /** Times user unmarked a randomly forced discard pick (round-5) */
  timesUnmarkedForcedDiscard: number;
  timesLeftInHandAtEnd: number;
  totalHoldMs: number;
  wins: number;
  favoriteMarks: number;
}

/** CardStat with derived rates for Historial Stats tab */
export interface CardStatView extends CardStat {
  playRate: number;
  discardRate: number;
  staleRate: number;
  winRate: number;
  avgHoldMs: number;
  problemScore: number;
}
