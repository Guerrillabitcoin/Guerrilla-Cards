import type { GameState } from './types';
import { MAX_PLAYERS, MIN_PLAYERS, MULTI_BOT_MAX } from './types';
import * as Engine from './game';
import { randomNickname } from './nicknames';

export function humanPlayers(state: GameState) {
  return state.players.filter((p) => !p.isBot);
}

export function botPlayers(state: GameState) {
  return state.players.filter((p) => !!p.isBot);
}

export function humanCount(state: GameState): number {
  return humanPlayers(state).length;
}

export function botCountOf(state: GameState): number {
  return botPlayers(state).length;
}

/** Max bots allowed given human seats (maxPlayers) and current humans. */
export function maxLiveBotsAllowed(
  humanCap: number,
  currentHumans: number
): number {
  const cap = Math.max(
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, Math.floor(humanCap) || MAX_PLAYERS)
  );
  const humans = Math.max(0, Math.floor(currentHumans));
  return Math.max(
    0,
    Math.min(MULTI_BOT_MAX, MAX_PLAYERS - cap, MAX_PLAYERS - humans)
  );
}

function uniqueBotNick(used: Set<string>): string {
  for (let i = 0; i < 48; i++) {
    const base = randomNickname();
    const nick = `${base} (Bot)`.slice(0, 42);
    if (!used.has(nick.toLowerCase())) return nick;
  }
  let n = 1;
  while (used.has(`Bot${n} (Bot)`.toLowerCase())) n++;
  return `Bot${n} (Bot)`.slice(0, 42);
}

/**
 * Multi (async/live) lobby only: set exact bot seat count (0–MULTI_BOT_MAX).
 * Keeps existing bot ids/nicks when shrinking/growing (removes from end;
 * only creates new seats when growing). Solo must use addSoloBots / createSoloGame.
 */
export function setLiveBots(state: GameState, count: number): GameState {
  if (state.mode === 'solo') {
    throw new Error('Usa addSoloBots en modo solo.');
  }
  if (state.phase !== 'lobby') {
    throw new Error('Solo se pueden cambiar bots en la sala.');
  }
  const humans = humanPlayers(state);
  const humanCap = Math.max(
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, state.maxPlayers ?? MAX_PLAYERS)
  );
  const target = Math.max(
    0,
    Math.min(
      Math.floor(count) || 0,
      maxLiveBotsAllowed(humanCap, humans.length)
    )
  );

  let next: GameState = {
    ...state,
    // Temporarily treat as live so addPlayer uses MAX_PLAYERS hard cap
    mode: 'live',
  };
  let bots = botPlayers(next);

  while (bots.length > target) {
    const doomed = bots[bots.length - 1];
    next = Engine.removePlayer(next, doomed.id);
    bots = botPlayers(next);
  }

  const used = new Set(next.players.map((p) => p.nickname.toLowerCase()));
  while (bots.length < target && next.players.length < MAX_PLAYERS) {
    const nick = uniqueBotNick(used);
    used.add(nick.toLowerCase());
    next = Engine.addPlayer(next, nick, { isBot: true });
    bots = botPlayers(next);
  }

  return {
    ...next,
    mode: state.mode,
    maxPlayers: humanCap,
    botCount: bots.length,
    updatedAt: Date.now(),
  };
}

/** Ids of humans who submitted this round (eligible to vote). */
export function humanVoterIds(state: GameState): string[] {
  const botIds = new Set(
    state.players.filter((p) => p.isBot).map((p) => p.id)
  );
  return (state.submissions || [])
    .filter((s) => s && !s.rival && s.playerId && !botIds.has(s.playerId))
    .map((s) => s.playerId);
}
