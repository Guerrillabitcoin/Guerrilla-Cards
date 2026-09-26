export type CardType = 'prompt' | 'answer';

export interface Card {
  id: string;
  type: CardType;
  text: string;
  pick: number;
  reason?: string;
  would_be_pack?: string;
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
  isBot?: boolean;
}

export interface Submission {
  playerId: string;
  cards: Card[];
  rival?: boolean;
  round?: number;
}

export interface GameState {
  code: string;
  mode: GameMode;
  packIds: string[];
  players: Player[];
  phase: Phase;
  zarIndex: number;
  judgeMode: JudgeMode;
  votes?: Record<string, string>;
  currentPrompt: Card | null;
  submissions: Submission[];
  revealOrder: number[];
  roundWinnerId: string | null;
  roundWinnerIds?: string[];
  targetScore: number;
  round: number;
  activeSeatId: string | null;
  usedPromptIds: string[];
  promptDeck: Card[];
  promptDeckPos: number;
  answerDeck: Card[];
  answerDeckPos: number;
  createdAt: number;
  updatedAt: number;
  discardRoundCompleted: boolean;
  discardDonePlayerIds: string[];
  lastDiscarded?: { playerId: string; cards: Card[] }[];
  maxPlayers?: number;
  leagueScores?: Record<string, number>;
  restartReadyIds?: string[];
  leagueAwarded?: boolean;
  leagueMatchCount?: number;
}

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
  text: string;
  createdAt: number;
  promptText?: string;
  answers?: string[];
}

export interface DiscardStat {
  id: string;
  text: string;
  count: number;
}

export const HAND_SIZE = 12;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const ASYNC_TARGET_PLAYERS = 4;
export const ASYNC_MAX_PLAYERS = 8;
export const DEFAULT_TARGET_SCORE = 5;
export const SOLO_MAX_ROUNDS = 10;
export const SOLO_DEFAULT_TARGET = 10;
export const SOLO_BOT_COUNT_DEFAULT = 2;
export const SOLO_BOT_COUNT_MAX = 3;
export const SOLO_RIVAL_COUNT = 3;
export const DISCARD_AT_ROUND = 5;

export function shouldDiscardBeforeRound(
  n: number,
  mode?: GameMode | string | null
): boolean {
  if (!(n > 0 && n % DISCARD_AT_ROUND === 0)) return false;
  if (mode === 'solo' && n >= SOLO_MAX_ROUNDS) return false;
  return true;
}
export const DISCARD_MIN = 2;
export const DISCARD_MAX = 5;
export const DISCARD_COUNT = DISCARD_MIN;

export const BOT_NICKNAMES = [
  'Bot 1',
  'Bot 2',
  'IA Guerrilla',
  'Bot Guerrilla',
] as const;

export function coerceGameState(g: GameState): GameState {
  return {
    ...g,
    judgeMode: g.judgeMode ?? 'zar',
    votes: g.votes ?? {},
    roundWinnerIds: g.roundWinnerIds ?? [],
    discardRoundCompleted: g.discardRoundCompleted ?? false,
    discardDonePlayerIds: g.discardDonePlayerIds ?? [],
    lastDiscarded: g.lastDiscarded ?? [],
    maxPlayers: g.maxPlayers ?? (g.mode === 'async' ? ASYNC_TARGET_PLAYERS : MAX_PLAYERS),
    leagueScores: g.leagueScores ?? {},
    restartReadyIds: g.restartReadyIds ?? [],
    leagueAwarded: g.leagueAwarded ?? false,
    leagueMatchCount: g.leagueMatchCount ?? 0,
    usedPromptIds: g.usedPromptIds ?? [],
    promptDeck: g.promptDeck ?? [],
    promptDeckPos: g.promptDeckPos ?? 0,
    answerDeck: g.answerDeck ?? [],
    answerDeckPos: g.answerDeckPos ?? 0,
  };
}

export interface CardStat {
  cardId: string;
  text: string;
  kind: 'answer' | 'prompt';
  timesDrawn: number;
  timesPlayed: number;
  timesDiscarded: number;
  timesUnmarkedForcedDiscard: number;
  timesLeftInHandAtEnd: number;
  totalHoldMs: number;
  wins: number;
  favoriteMarks: number;
}

export interface CardStatView extends CardStat {
  playRate: number;
  discardRate: number;
  staleRate: number;
  winRate: number;
  avgHoldMs: number;
  problemScore: number;
}
