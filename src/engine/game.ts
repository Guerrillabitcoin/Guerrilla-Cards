import {
  buildPreShuffledAnswerDeck,
  buildVariedPromptDeck,
  fillBlank,
  loadCombinedDeck,
  shuffle,
} from './deck';
import {
  ASYNC_TARGET_PLAYERS,
  BOT_NICKNAMES,
  DEFAULT_TARGET_SCORE,
  DISCARD_COUNT,
  DISCARD_MIN,
  DISCARD_MAX,
  shouldDiscardBeforeRound,
  SOLO_MAX_ROUNDS,
  SOLO_DEFAULT_TARGET,
  HAND_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SOLO_BOT_COUNT_DEFAULT,
  SOLO_BOT_COUNT_MAX,
  SOLO_RIVAL_COUNT,
  type Card,
  type GameMode,
  type GameState,
  type JudgeMode,
  type Player,
  type Submission,
} from './types';

export {
  ASYNC_TARGET_PLAYERS,
  DISCARD_AT_ROUND,
  DISCARD_COUNT,
  DISCARD_MIN,
  DISCARD_MAX,
  shouldDiscardBeforeRound,
  SOLO_MAX_ROUNDS,
  SOLO_DEFAULT_TARGET,
} from './types';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function now(): number {
  return Date.now();
}

function isVoteMode(state: GameState): boolean {
  return (state.judgeMode ?? 'zar') === 'vote';
}

/** Zar mode (async/live): next Zar is the round winner. Solo stays 0. Vote mode: +1. */
function nextZarIndex(state: GameState): number {
  if (state.mode === 'solo') return 0;
  if (!isVoteMode(state) && state.roundWinnerId) {
    const idx = state.players.findIndex((p) => p.id === state.roundWinnerId);
    if (idx >= 0) return idx;
  }
  return (state.zarIndex + 1) % state.players.length;
}

export function createGame(opts: {
  hostNickname: string;
  mode: GameMode;
  packIds: string[];
  targetScore?: number;
  code?: string;
  judgeMode?: JudgeMode;
  /** Prompt ids seen recently (other matches) — put later in the deck */
  avoidPromptIds?: string[];
  avoidAnswerIds?: string[];
}): GameState {
  const packs = opts.packIds.length ? opts.packIds : ['core'];
  const { prompts, answers } = loadCombinedDeck(packs);
  const minAnswers =
    opts.mode === 'solo'
      ? HAND_SIZE * 1 + SOLO_RIVAL_COUNT * 3
      : HAND_SIZE * MIN_PLAYERS;
  if (prompts.length < 5 || answers.length < minAnswers) {
    throw new Error(
      'Mazos insuficientes: elige packs con más cartas (mín. 5 prompts y suficientes respuestas).'
    );
  }

  const host: Player = {
    id: uid('p'),
    nickname: opts.hostNickname.trim() || 'Anfitrión',
    isHost: true,
    score: 0,
    hand: [],
    isBot: false,
  };

  return {
    code: opts.code ?? generateCode(),
    mode: opts.mode,
    packIds: packs,
    players: [host],
    phase: 'lobby',
    zarIndex: 0,
    judgeMode: opts.judgeMode ?? 'zar',
    votes: {},
    currentPrompt: null,
    submissions: [],
    revealOrder: [],
    roundWinnerId: null,
    roundWinnerIds: [],
    targetScore:
      opts.targetScore ??
      (opts.mode === 'async' || opts.mode === 'solo'
        ? SOLO_DEFAULT_TARGET
        : DEFAULT_TARGET_SCORE),
    round: 0,
    activeSeatId: host.id,
    usedPromptIds: [],
    // All RNG for the match happens here (and on restart) — not between rounds
    promptDeck: buildVariedPromptDeck(prompts, opts.avoidPromptIds ?? []),
    promptDeckPos: 0,
    answerDeck: buildPreShuffledAnswerDeck(
      answers,
      opts.avoidAnswerIds ?? [],
      3
    ),
    answerDeckPos: 0,
    createdAt: now(),
    updatedAt: now(),
    discardRoundCompleted: false,
    discardDonePlayerIds: [],
    lastDiscarded: [],
  };
}

export function addPlayer(
  state: GameState,
  nickname: string,
  opts?: { isBot?: boolean }
): GameState {
  if (state.phase !== 'lobby') throw new Error('La partida ya empezó.');
  const maxSeats =
    state.mode === 'async' ? ASYNC_TARGET_PLAYERS : MAX_PLAYERS;
  if (state.players.length >= maxSeats) {
    throw new Error(`Máximo ${maxSeats} jugadores.`);
  }
  const nick = nickname.trim();
  if (!nick) throw new Error('Pon un apodo.');
  if (state.players.some((p) => p.nickname.toLowerCase() === nick.toLowerCase())) {
    throw new Error('Ese apodo ya está en uso.');
  }
  const player: Player = {
    id: uid('p'),
    nickname: nick,
    isHost: false,
    score: 0,
    hand: [],
    isBot: opts?.isBot ?? false,
  };
  return {
    ...state,
    players: [...state.players, player],
    updatedAt: now(),
  };
}


export function renamePlayer(
  state: GameState,
  playerId: string,
  nickname: string
): GameState {
  if (state.phase !== 'lobby') {
    throw new Error('Solo puedes cambiar el nombre en el lobby.');
  }
  const nick = nickname.trim();
  if (!nick) throw new Error('Pon un apodo.');
  if (
    state.players.some(
      (p) =>
        p.id !== playerId &&
        p.nickname.toLowerCase() === nick.toLowerCase()
    )
  ) {
    throw new Error('Ese apodo ya está en uso.');
  }
  if (!state.players.some((p) => p.id === playerId)) {
    throw new Error('Jugador no encontrado.');
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, nickname: nick.slice(0, 42) } : p
    ),
    updatedAt: now(),
  };
}

/** Add 2–3 bot seats for solo mode (lobby only). Kept for back-compat; unused by new solo. */
export function addSoloBots(
  state: GameState,
  count: number = SOLO_BOT_COUNT_DEFAULT
): GameState {
  if (state.mode !== 'solo') {
    throw new Error('Solo se pueden añadir bots en modo solo.');
  }
  const n = Math.min(
    Math.max(count, MIN_PLAYERS - 1),
    SOLO_BOT_COUNT_MAX,
    MAX_PLAYERS - state.players.length
  );
  let next = state;
  const used = new Set(next.players.map((p) => p.nickname.toLowerCase()));
  let nameIdx = 0;
  let added = 0;
  while (added < n && next.players.length < MAX_PLAYERS) {
    const candidate =
      BOT_NICKNAMES[nameIdx] ?? `Bot ${nameIdx + 1}`;
    nameIdx++;
    if (used.has(candidate.toLowerCase())) continue;
    used.add(candidate.toLowerCase());
    next = addPlayer(next, candidate, { isBot: true });
    added++;
  }
  return next;
}

/**
 * Create solo lobby: host ONLY (no bot seats). Caller starts immediately.
 * `botCount` accepted for API back-compat but ignored.
 */
export function createSoloGame(opts: {
  hostNickname: string;
  packIds: string[];
  targetScore?: number;
  botCount?: number;
  avoidPromptIds?: string[];
  avoidAnswerIds?: string[];
}): GameState {
  return createGame({
    hostNickname: opts.hostNickname,
    mode: 'solo',
    packIds: opts.packIds,
    targetScore: opts.targetScore ?? SOLO_DEFAULT_TARGET,
    avoidPromptIds: opts.avoidPromptIds,
    avoidAnswerIds: opts.avoidAnswerIds,
  });
}

/**
 * After the human submits in solo, draw random rival answers from the answer deck
 * (not from bot hands) then auto-reveal with the human answer first (Siguiente ronda ready).
 */
export function injectSoloRivals(
  state: GameState,
  rivalCount: number = SOLO_RIVAL_COUNT
): GameState {
  const pick = Math.max(1, state.currentPrompt?.pick ?? 1);
  const usedIds = new Set(
    state.submissions.flatMap((s) => s.cards.map((c) => c.id))
  );
  let answerDeck = state.answerDeck;
  let answerDeckPos = state.answerDeckPos ?? 0;
  const submissions: Submission[] = [...state.submissions];

  for (let i = 0; i < rivalCount; i++) {
    const cards: Card[] = [];
    let guard = 0;
    while (cards.length < pick && guard++ < answerDeck.length + pick + 8) {
      if (answerDeckPos >= answerDeck.length) {
        const extra = refillAnswerDeck(state);
        if (!extra.length) break;
        answerDeck = answerDeck.concat(extra);
      }
      const c = answerDeck[answerDeckPos++];
      if (usedIds.has(c.id)) continue;
      usedIds.add(c.id);
      cards.push(c);
    }
    if (cards.length < pick) {
      throw new Error(
        'Se acabaron las cartas de respuesta para rivales. Reinicia con más packs.'
      );
    }
    submissions.push({
      playerId: `rival-${i + 1}`,
      cards,
      rival: true,
      round: state.round,
    });
  }

  const human =
    state.players.find((p) => !p.isBot) ?? state.players[0];
  // Human answer first, then rivals (for solo review scroll).
  const humanIdx = submissions.findIndex(
    (s) => human && s.playerId === human.id && !s.rival
  );
  const order = [
    ...(humanIdx >= 0 ? [humanIdx] : []),
    ...submissions
      .map((_, i) => i)
      .filter((i) => i !== humanIdx),
  ];

  const withSubs: GameState = {
    ...state,
    answerDeck,
    answerDeckPos,
    submissions,
    revealOrder: order,
    phase: 'judging',
    activeSeatId: human?.id ?? state.activeSeatId,
    updatedAt: now(),
  };

  // Solo: your fill is the round — skip picking a winner; go straight to reveal
  // so "Siguiente ronda" appears right after you tap your card(s).
  if (human) {
    return judgePick(withSubs, human.id);
  }
  return withSubs;
}

/** Pick random card ids from a player's hand for the given pick count. */
export function pickRandomFromHand(player: Player, pick: number): string[] {
  if (player.hand.length < pick) {
    throw new Error('Mano insuficiente para el bot.');
  }
  return shuffle(player.hand)
    .slice(0, pick)
    .map((c) => c.id);
}

/** Auto-submit for all pending bots that are not the zar (submitting phase). Kept for back-compat. */
export function autoSubmitBots(state: GameState): GameState {
  if (state.phase !== 'submitting') return state;
  const zarId = state.players[state.zarIndex]?.id;
  let next = state;
  for (const p of state.players) {
    if (next.phase !== 'submitting') break;
    if (!p.isBot) continue;
    if (p.id === zarId) continue;
    if (next.submissions.some((s) => s.playerId === p.id)) continue;
    const live = next.players.find((x) => x.id === p.id);
    if (!live) continue;
    const pick = Math.max(1, next.currentPrompt?.pick ?? 1);
    const ids = pickRandomFromHand(live, pick);
    next = submitCards(next, live.id, ids);
  }
  return next;
}

/** Bot zar picks a random submission as winner. Kept for back-compat. */
export function autoJudgeBot(state: GameState): GameState {
  if (state.phase !== 'judging') return state;
  const zar = state.players[state.zarIndex];
  if (!zar?.isBot) return state;
  if (!state.submissions.length) return state;
  const pick = state.submissions[Math.floor(Math.random() * state.submissions.length)];
  return judgePick(state, pick.playerId);
}

export function removePlayer(state: GameState, playerId: string): GameState {
  if (state.phase !== 'lobby') throw new Error('Solo en el lobby.');
  const players = state.players.filter((p) => p.id !== playerId || p.isHost);
  return { ...state, players, updatedAt: now() };
}

function answerRemaining(state: GameState): number {
  return Math.max(0, (state.answerDeck?.length ?? 0) - (state.answerDeckPos ?? 0));
}

function drawAnswers(
  deck: Card[],
  pos: number,
  n: number
): { drawn: Card[]; pos: number } {
  if (n <= 0) return { drawn: [], pos };
  if (deck.length - pos < n) {
    throw new Error('Se acabaron las cartas de respuesta. Reinicia con más packs.');
  }
  return { drawn: deck.slice(pos, pos + n), pos: pos + n };
}

/** Emergency top-up only. Real shuffle is at create/reiniciar. */
function refillAnswerDeck(state: GameState): Card[] {
  const { answers } = loadCombinedDeck(state.packIds);
  const inHand = new Set(
    state.players.flatMap((p) => p.hand.map((c) => c.id))
  );
  return answers.filter((c) => !inHand.has(c.id));
}

function ensureAnswerDeck(state: GameState, need: number): GameState {
  if (answerRemaining(state) >= need) return state;
  return {
    ...state,
    answerDeck: state.answerDeck.concat(refillAnswerDeck(state)),
  };
}

/**
 * Take cards out of the hand and put freshly drawn ones in the SAME slots
 * (sorted by hand index), so scroll position / muscle memory stays stable.
 */
function replaceInHand(
  hand: Card[],
  cardIds: string[],
  deck: Card[],
  pos: number
): { hand: Card[]; answerDeck: Card[]; answerDeckPos: number } {
  const idSet = new Set(cardIds);
  const indices = hand
    .map((c, i) => (idSet.has(c.id) ? i : -1))
    .filter((i) => i >= 0);
  if (indices.length === 0) {
    return { hand, answerDeck: deck, answerDeckPos: pos };
  }
  const { drawn, pos: nextPos } = drawAnswers(deck, pos, indices.length);
  const next = [...hand];
  indices.forEach((idx, j) => {
    next[idx] = drawn[j];
  });
  return { hand: next, answerDeck: deck, answerDeckPos: nextPos };
}

function drawPrompt(state: GameState): {
  prompt: Card;
  promptDeck: Card[];
  promptDeckPos: number;
  usedPromptIds: string[];
} {
  let deck = state.promptDeck ?? [];
  let pos = state.promptDeckPos ?? 0;
  let used = state.usedPromptIds ?? [];
  if (pos >= deck.length) {
    const { prompts } = loadCombinedDeck(state.packIds);
    const usedSet = new Set(used);
    const unused = prompts.filter((p) => !usedSet.has(p.id));
    // Reshuffle remaining / full cycle — never replay raw pack order
    deck = unused.length
      ? buildVariedPromptDeck(unused, [])
      : buildVariedPromptDeck(prompts, used.slice(-Math.floor(prompts.length * 0.5)));
    pos = 0;
    if (!unused.length) used = [];
  }
  const prompt = deck[pos];
  return {
    prompt,
    promptDeck: deck,
    promptDeckPos: pos + 1,
    usedPromptIds: [...used, prompt.id],
  };
}

/**
 * Deal until HAND_SIZE, never giving a card id already present in any hand.
 * Skips occupied ids while walking the answer deck; refills excluding occupied.
 */
function dealHands(state: GameState): GameState {
  let next = state;
  let answerDeck = next.answerDeck;
  let answerDeckPos = next.answerDeckPos ?? 0;

  const players: Player[] = next.players.map((p) =>
    p.hand.length > HAND_SIZE ? { ...p, hand: p.hand.slice(0, HAND_SIZE) } : p
  );
  const occupied = new Set(players.flatMap((p) => p.hand.map((c) => c.id)));

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const need = HAND_SIZE - p.hand.length;
    if (need <= 0) continue;

    const drawn: Card[] = [];
    let guard = 0;
    const maxGuard = Math.max(answerDeck.length * 3, need * 40, 128);
    while (drawn.length < need && guard++ < maxGuard) {
      if (answerDeckPos >= answerDeck.length) {
        const partialPlayers = players.map((pl, j) =>
          j === i ? { ...pl, hand: [...pl.hand, ...drawn] } : pl
        );
        const extra = refillAnswerDeck({
          ...next,
          answerDeck,
          answerDeckPos,
          players: partialPlayers,
        }).filter((c) => !occupied.has(c.id));
        if (!extra.length) break;
        answerDeck = answerDeck.concat(extra);
        next = { ...next, answerDeck, answerDeckPos };
      }
      if (answerDeckPos >= answerDeck.length) break;
      const c = answerDeck[answerDeckPos++];
      if (occupied.has(c.id)) continue;
      occupied.add(c.id);
      drawn.push(c);
    }
    if (drawn.length < need) {
      throw new Error(
        'Se acabaron las cartas de respuesta distintas. Reinicia con más packs.'
      );
    }
    players[i] = { ...p, hand: [...p.hand, ...drawn] };
  }
  return { ...next, players, answerDeck, answerDeckPos };
}

export function startGame(state: GameState): GameState {
  if (state.mode === 'async') {
    if (state.players.length !== ASYNC_TARGET_PLAYERS) {
      throw new Error(
        `Async necesita exactamente ${ASYNC_TARGET_PLAYERS} jugadores.`
      );
    }
  } else {
    const minPlayers = state.mode === 'solo' ? 1 : MIN_PLAYERS;
    if (state.players.length < minPlayers) {
      throw new Error(`Haz falta al menos ${minPlayers} jugadores.`);
    }
    if (state.players.length > MAX_PLAYERS) {
      throw new Error(`Máximo ${MAX_PLAYERS} jugadores.`);
    }
  }
  let next = dealHands({ ...state, zarIndex: 0, round: 0 });
  next = beginRound(next);
  return { ...next, updatedAt: now() };
}

export function beginRound(state: GameState): GameState {
  const dealt = dealHands(state);
  const { prompt, promptDeck, promptDeckPos, usedPromptIds } = drawPrompt(dealt);
  const isSolo = dealt.mode === 'solo';

  // Hand is always HAND_SIZE (12); multipick uses cards from the same hand
  // without drawing extras (never grow above 12).
  let answerDeck = dealt.answerDeck;
  let answerDeckPos = dealt.answerDeckPos ?? 0;
  let players = dealt.players;

  const human =
    players.find((p) => !p.isBot) ?? players[0];
  const zar = players[dealt.zarIndex];

  let activeSeatId: string;
  if (isSolo) {
    activeSeatId = human?.id ?? zar.id;
  } else if (isVoteMode(dealt)) {
    // Vote: everyone submits, including Zar seat
    const firstSubmitter =
      players.find((p) => !p.isBot) ?? players[0];
    activeSeatId = firstSubmitter?.id ?? zar.id;
  } else {
    const firstSubmitter =
      players.find((p, i) => i !== dealt.zarIndex && !p.isBot) ??
      players.find((_, i) => i !== dealt.zarIndex);
    activeSeatId = firstSubmitter?.id ?? zar.id;
  }

  return {
    ...dealt,
    players,
    currentPrompt: prompt,
    promptDeck,
    promptDeckPos,
    answerDeck,
    answerDeckPos,
    usedPromptIds,
    submissions: [],
    revealOrder: [],
    roundWinnerId: null,
    roundWinnerIds: [],
    votes: {},
    phase: 'submitting',
    round: dealt.round + 1,
    activeSeatId,
    updatedAt: now(),
  };
}

export function setActiveSeat(state: GameState, seatId: string): GameState {
  return { ...state, activeSeatId: seatId, updatedAt: now() };
}

export function submitCards(
  state: GameState,
  playerId: string,
  cardIds: string[]
): GameState {
  if (state.phase !== 'submitting') throw new Error('No es fase de envío.');
  const zar = state.players[state.zarIndex];
  const isSolo = state.mode === 'solo';
  const voteMode = isVoteMode(state);
  // Zar skips answers only in zar judge mode (not vote, not solo)
  if (!isSolo && !voteMode && playerId === zar.id) {
    throw new Error('El Zar no envía cartas.');
  }
  if (state.submissions.some((s) => s.playerId === playerId)) {
    throw new Error('Ya enviaste tu jugada.');
  }
  const pick = Math.max(1, state.currentPrompt?.pick ?? 1);
  if (cardIds.length !== pick) {
    throw new Error(`Elige exactamente ${pick} carta(s).`);
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Jugador no encontrado.');

  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = player.hand.find((h) => h.id === id);
    if (!c) throw new Error('Carta no está en tu mano.');
    if (cards.some((x) => x.id === id)) throw new Error('Carta duplicada.');
    cards.push(c);
  }

  const ready = ensureAnswerDeck(state, cardIds.length);
  const { hand: newHand, answerDeck, answerDeckPos } = replaceInHand(
    player.hand,
    cardIds,
    ready.answerDeck,
    ready.answerDeckPos ?? 0
  );
  const players = ready.players.map((p) =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );
  const submissions: Submission[] = [
    ...submissionsForRound(state).filter((s) => !s.rival || state.mode === 'solo'),
    { playerId, cards, round: state.round },
  ];

  // Solo: after human submits, inject random rival answers and go to judging
  if (isSolo) {
    return injectSoloRivals({
      ...state,
      players,
      answerDeck,
      answerDeckPos,
      submissions,
      updatedAt: now(),
    });
  }

  const needed = voteMode ? state.players.length : state.players.length - 1;
  const allIn = submissions.length >= needed;

  if (allIn) {
    const order = shuffle([...submissions.keys()]);
    const firstVoter =
      state.players.find((p) => !p.isBot) ?? state.players[0];
    return {
      ...state,
      players,
      answerDeck,
      answerDeckPos,
      submissions,
      revealOrder: order,
      votes: {},
      phase: 'judging',
      activeSeatId: voteMode ? firstVoter?.id ?? zar.id : zar.id,
      updatedAt: now(),
    };
  }

  // Prefer next human who hasn't submitted; zar mode excludes zar
  const pending = state.players.filter(
    (p) =>
      (voteMode || p.id !== zar.id) &&
      p.id !== playerId &&
      !submissions.some((s) => s.playerId === p.id)
  );
  const nextPlayer =
    pending.find((p) => !p.isBot) ?? pending[0] ?? undefined;

  return {
    ...state,
    players,
    answerDeck,
    answerDeckPos,
    submissions,
    activeSeatId: nextPlayer?.id ?? zar.id,
    updatedAt: now(),
  };
}

/** Apply round winner (scoring + reveal/results). Used by judgePick and castVote. */
function applyRoundWinner(
  state: GameState,
  winnerPlayerId: string
): GameState {
  const zar = state.players[state.zarIndex];
  const submission = state.submissions.find((s) => s.playerId === winnerPlayerId);
  if (!submission) {
    throw new Error('Esa jugada no existe.');
  }

  const isRival =
    !!submission.rival || winnerPlayerId.startsWith('rival-');
  const isSolo = state.mode === 'solo';
  const voteMode = isVoteMode(state);

  // Zar cannot win their own round — except solo, rivals, or vote mode (everyone plays)
  if (!isSolo && !isRival && !voteMode && winnerPlayerId === zar.id) {
    throw new Error('El Zar no puede ganar su ronda.');
  }

  // Only increment score if winner is a real player in state.players
  const winnerIsRealPlayer = state.players.some((p) => p.id === winnerPlayerId);
  const players = winnerIsRealPlayer
    ? state.players.map((p) =>
        p.id === winnerPlayerId ? { ...p, score: p.score + 1 } : p
      )
    : state.players;

  const winnerScore = winnerIsRealPlayer
    ? players.find((p) => p.id === winnerPlayerId)!.score
    : 0;

  if (winnerIsRealPlayer && winnerScore >= state.targetScore) {
    return {
      ...state,
      players,
      roundWinnerId: winnerPlayerId,
      roundWinnerIds: [],
      phase: 'results',
      activeSeatId: null,
      updatedAt: now(),
    };
  }

  return {
    ...state,
    players,
    roundWinnerId: winnerPlayerId,
    roundWinnerIds: [],
    phase: 'reveal',
    updatedAt: now(),
  };
}

/**
 * Vote ties (2+): +1 each real player, roundWinnerIds=tied, roundWinnerId=tied[0].
 * No revealOrder tiebreak. Results if any hits targetScore.
 */
export function applyRoundWinners(
  state: GameState,
  winnerIds: string[]
): GameState {
  const ids = [...new Set(winnerIds)];
  if (ids.length < 2) {
    throw new Error('applyRoundWinners requiere al menos 2 ganadores.');
  }
  for (const id of ids) {
    if (!state.submissions.some((s) => s.playerId === id)) {
      throw new Error('Esa jugada no existe.');
    }
  }

  let players = state.players;
  for (const id of ids) {
    const sub = state.submissions.find((s) => s.playerId === id);
    const isRival = !!sub?.rival || id.startsWith('rival-');
    if (isRival) continue;
    if (!players.some((p) => p.id === id)) continue;
    players = players.map((p) =>
      p.id === id ? { ...p, score: p.score + 1 } : p
    );
  }

  const anyHitTarget = ids.some((id) => {
    const p = players.find((x) => x.id === id);
    return !!p && p.score >= state.targetScore;
  });

  return {
    ...state,
    players,
    roundWinnerIds: ids,
    roundWinnerId: ids[0] ?? null,
    phase: anyHitTarget ? 'results' : 'reveal',
    activeSeatId: anyHitTarget ? null : state.activeSeatId,
    updatedAt: now(),
  };
}



/**
 * Online sync helper: if enough players have submitted, enter judging
 * regardless of who submitted in which order / on which device.
 */

/** Keep only submissions that belong to this round (drop leaked prior-round answers). */
export function submissionsForRound(
  state: GameState,
  submissions: Submission[] = state.submissions
): Submission[] {
  const r = state.round;
  return (submissions ?? []).filter((s) => {
    if (s.round == null) return true; // legacy mid-match
    return s.round === r;
  });
}

export function advanceToJudgingIfReady(state: GameState): GameState {
  if (state.phase !== 'submitting') return state;
  if (state.mode === 'solo') return state;
  const voteMode = isVoteMode(state);
  const zar = state.players[state.zarIndex];
  const realSubs = submissionsForRound(state).filter((s) => !s.rival);
  const needed = voteMode
    ? state.players.length
    : Math.max(0, state.players.length - 1);
  if (realSubs.length < needed) return state;

  // Drop accidental zar submission in zar mode
  const submissions = voteMode
    ? realSubs
    : realSubs.filter((s) => s.playerId !== zar?.id);
  if (submissions.length < needed) return state;

  const order = shuffle([...submissions.keys()]);
  const firstVoter =
    state.players.find((p) => !p.isBot) ?? state.players[0];
  return {
    ...state,
    submissions,
    revealOrder: order,
    votes: {},
    phase: 'judging',
    activeSeatId: voteMode ? firstVoter?.id ?? zar?.id ?? null : zar?.id ?? null,
    updatedAt: now(),
  };
}

/** Ensure revealOrder is a full permutation of submission indices (reshuffle if missing/stale). */
export function ensureRevealOrder(state: GameState): GameState {
  const n = state.submissions.length;
  if (n === 0) {
    return state.revealOrder?.length ? { ...state, revealOrder: [] } : state;
  }
  const order = state.revealOrder ?? [];
  const valid =
    order.length === n &&
    order.every((i) => typeof i === 'number' && i >= 0 && i < n) &&
    new Set(order).size === n;
  if (valid) return state;
  return {
    ...state,
    revealOrder: shuffle([...Array(n).keys()]),
    updatedAt: now(),
  };
}

/**
 * Zar picks a winning submission (zar judge mode only).
 * In vote mode, winners are finalized only via castVote auto-tally.
 */
export function judgePick(state: GameState, winnerPlayerId: string): GameState {
  if (state.phase !== 'judging') throw new Error('No es fase de juicio.');
  if (isVoteMode(state) && state.mode !== 'solo') {
    throw new Error('En modo voto el ganador sale del recuento (castVote).');
  }
  const ready = ensureRevealOrder(state);
  return applyRoundWinner(ready, winnerPlayerId);
}

/**
 * Vote mode: cast one vote for a submission (cannot vote own).
 * When all eligible voters have voted, tallies majority → applyRoundWinner.
 * Ties (2+): applyRoundWinners — +1 each, no revealOrder tiebreak.
 */
export function castVote(
  state: GameState,
  voterId: string,
  submissionPlayerId: string
): GameState {
  if (state.phase !== 'judging') throw new Error('No es fase de juicio.');
  if (!isVoteMode(state)) {
    throw new Error('castVote solo en modo voto.');
  }
  state = ensureRevealOrder(state);
  const voter = state.players.find((p) => p.id === voterId);
  if (!voter) throw new Error('Votante no encontrado.');
  if (!state.submissions.some((s) => s.playerId === voterId)) {
    throw new Error('Solo quien envió respuesta puede votar.');
  }
  if (voterId === submissionPlayerId) {
    throw new Error('No puedes votar tu propia respuesta.');
  }
  if (!state.submissions.some((s) => s.playerId === submissionPlayerId)) {
    throw new Error('Esa jugada no existe.');
  }
  const prevVotes = state.votes ?? {};
  if (prevVotes[voterId]) {
    throw new Error('Ya has votado esta ronda.');
  }

  const votes = { ...prevVotes, [voterId]: submissionPlayerId };

  // Eligible = everyone who submitted (all humans in vote mode)
  const eligible = state.submissions
    .filter((s) => !s.rival)
    .map((s) => s.playerId);
  const allVoted = eligible.every((id) => !!votes[id]);

  if (!allVoted) {
    const pending = eligible.filter((id) => !votes[id]);
    const nextSeat =
      state.players.find((p) => pending.includes(p.id) && !p.isBot) ??
      state.players.find((p) => pending.includes(p.id));
    return {
      ...state,
      votes,
      activeSeatId: nextSeat?.id ?? state.activeSeatId,
      updatedAt: now(),
    };
  }

  // Tally: majority wins; 2+ tie → applyRoundWinners (no revealOrder tiebreak)
  const tallies: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    tallies[target] = (tallies[target] ?? 0) + 1;
  }
  let bestCount = -1;
  for (const n of Object.values(tallies)) {
    if (n > bestCount) bestCount = n;
  }
  const tied = Object.keys(tallies).filter((id) => tallies[id] === bestCount);
  const withVotes = { ...state, votes };
  if (tied.length >= 2) {
    return applyRoundWinners(withVotes, tied);
  }
  return applyRoundWinner(withVotes, tied[0]);
}

/** Enter discarding phase before a multiple-of-DISCARD_AT_ROUND round (zar not rotated yet). */
export function startDiscardRound(state: GameState): GameState {
  const firstHuman =
    state.players.find((p) => !p.isBot) ?? state.players[0];
  return {
    ...state,
    phase: 'discarding',
    discardDonePlayerIds: [],
    lastDiscarded: [],
    discardRoundCompleted: false,
    activeSeatId: firstHuman?.id ?? null,
    updatedAt: now(),
  };
}

/**
 * Player discards between min(DISCARD_MIN, hand.length) and min(DISCARD_MAX, hand.length) cards.
 * When everyone is done: refill hands, flag completed, beginRound with next zar.
 */
export function submitDiscard(
  state: GameState,
  playerId: string,
  cardIds: string[]
): GameState {
  if (state.phase !== 'discarding') throw new Error('No es fase de descarte.');
  if (state.discardDonePlayerIds.includes(playerId)) {
    throw new Error('Ya descartaste.');
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Jugador no encontrado.');

  const handLen = player.hand.length;
  const minNeed = Math.min(DISCARD_MIN, handLen);
  const maxNeed = Math.min(DISCARD_MAX, handLen);
  if (cardIds.length < minNeed || cardIds.length > maxNeed) {
    throw new Error(
      handLen === 0
        ? 'No tienes cartas que descartar.'
        : minNeed === maxNeed
          ? `Elige exactamente ${minNeed} carta(s) para descartar.`
          : `Elige entre ${minNeed} y ${maxNeed} carta(s) para descartar.`
    );
  }

  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = player.hand.find((h) => h.id === id);
    if (!c) throw new Error('Carta no está en tu mano.');
    if (cards.some((x) => x.id === id)) throw new Error('Carta duplicada.');
    cards.push(c);
  }

  const ready = ensureAnswerDeck(state, cardIds.length);
  const { hand: newHand, answerDeck, answerDeckPos } = replaceInHand(
    player.hand,
    cardIds,
    ready.answerDeck,
    ready.answerDeckPos ?? 0
  );
  const players = ready.players.map((p) =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );
  const discardDonePlayerIds = [...ready.discardDonePlayerIds, playerId];
  const lastDiscarded = [
    ...(state.lastDiscarded ?? []),
    { playerId, cards },
  ];

  const allDone = discardDonePlayerIds.length >= state.players.length;

  if (allDone) {
    let next: GameState = {
      ...state,
      players,
      answerDeck,
      answerDeckPos,
      discardDonePlayerIds,
      lastDiscarded,
      discardRoundCompleted: true,
      updatedAt: now(),
    };
    next = dealHands(next);
    const zarIndex = nextZarIndex(next);
    return beginRound({ ...next, zarIndex });
  }

  const pending = state.players.filter(
    (p) => p.id !== playerId && !discardDonePlayerIds.includes(p.id)
  );
  const nextSeat = pending.find((p) => !p.isBot) ?? pending[0];

  return {
    ...state,
    players,
    answerDeck,
    answerDeckPos,
    discardDonePlayerIds,
    lastDiscarded,
    activeSeatId: nextSeat?.id ?? playerId,
    updatedAt: now(),
  };
}

/** Auto-discard exactly DISCARD_MIN (or hand length) for pending bots. Kept for back-compat. */
export function autoDiscardBots(state: GameState): GameState {
  if (state.phase !== 'discarding') return state;
  let next = state;
  for (const p of state.players) {
    if (next.phase !== 'discarding') break;
    if (!p.isBot) continue;
    if (next.discardDonePlayerIds.includes(p.id)) continue;
    const live = next.players.find((x) => x.id === p.id);
    if (!live) continue;
    const need = Math.min(DISCARD_MIN, live.hand.length);
    const ids =
      need === 0 ? [] : pickRandomFromHand(live, need);
    next = submitDiscard(next, live.id, ids);
  }
  return next;
}

/** Flat list of cards discarded in the current discard round (for historial). */
export function flushDiscardedCards(state: GameState): Card[] {
  return (state.lastDiscarded ?? []).flatMap((x) => x.cards);
}


/**
 * Solo: skip current prompt — discard 2 answer cards and start the next round
 * (no Puntaco). Caps at SOLO_MAX_ROUNDS.
 */
export function soloSkipRoundDiscard(
  state: GameState,
  playerId: string,
  cardIds: string[]
): GameState {
  if (state.mode !== 'solo') throw new Error('Solo en modo solo.');
  if (state.phase !== 'submitting') {
    throw new Error('Solo puedes descartar antes de responder.');
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Jugador no encontrado.');
  const need = Math.min(DISCARD_COUNT, player.hand.length);
  if (cardIds.length !== need) {
    throw new Error(
      need === 0
        ? 'No tienes cartas que descartar.'
        : `Elige exactamente ${need} carta(s) para descartar y saltar.`
    );
  }
  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = player.hand.find((h) => h.id === id);
    if (!c) throw new Error('Carta no está en tu mano.');
    if (cards.some((x) => x.id === id)) throw new Error('Carta duplicada.');
    cards.push(c);
  }
  const ready = ensureAnswerDeck(state, cardIds.length);
  const { hand: newHand, answerDeck, answerDeckPos } = replaceInHand(
    player.hand,
    cardIds,
    ready.answerDeck,
    ready.answerDeckPos ?? 0
  );
  const players = ready.players.map((p) =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );
  let next: GameState = {
    ...ready,
    players,
    answerDeck,
    answerDeckPos,
    submissions: [],
    revealOrder: [],
    roundWinnerId: null,
    roundWinnerIds: [],
    lastDiscarded: [...(state.lastDiscarded ?? []), { playerId, cards }],
    updatedAt: now(),
  };
  next = dealHands(next);
  if (next.round >= SOLO_MAX_ROUNDS) {
    return {
      ...next,
      phase: 'results',
      activeSeatId: null,
      updatedAt: now(),
    };
  }
  // If skip would start a discard-gated round (5, 10, 15…), force discard first
  const aboutToStart = next.round + 1;
  if (shouldDiscardBeforeRound(aboutToStart, next.mode)) {
    return startDiscardRound(next);
  }
  return beginRound(next);
}

export function nextRound(state: GameState): GameState {
  if (state.phase !== 'reveal') throw new Error('Termina el revelado primero.');
  state = { ...state, roundWinnerIds: [] };
  if (state.mode === 'solo') {
    if (state.round >= SOLO_MAX_ROUNDS) {
      return {
        ...state,
        phase: 'results',
        activeSeatId: null,
        updatedAt: now(),
      };
    }
    // Solo: discard before 5 (not before final round 10)
    const aboutToStart = state.round + 1;
    if (shouldDiscardBeforeRound(aboutToStart, 'solo')) {
      return startDiscardRound(state);
    }
    return beginRound({ ...state, zarIndex: 0 });
  }
  const aboutToStart = state.round + 1;
  if (shouldDiscardBeforeRound(aboutToStart, state.mode)) {
    return startDiscardRound(state);
  }
  const zarIndex = nextZarIndex(state);
  return beginRound({ ...state, zarIndex });
}

/**
 * In-place rematch: same code + seats (ids/nicknames/host), scores 0, reshuffled
 * decks, round 0 → startGame (phase submitting). Does not permanently rely on
 * discardRoundCompleted — that flag resets here.
 */
export function restartMatch(
  state: GameState,
  opts?: { avoidPromptIds?: string[]; avoidAnswerIds?: string[] }
): GameState {
  const packs = state.packIds.length ? state.packIds : ['core'];
  const { prompts, answers } = loadCombinedDeck(packs);
  const players = state.players.map((p) => ({
    ...p,
    score: 0,
    hand: [] as Card[],
  }));
  const reset: GameState = {
    ...state,
    players,
    phase: 'lobby',
    zarIndex: 0,
    votes: {},
    currentPrompt: null,
    submissions: [],
    revealOrder: [],
    roundWinnerId: null,
    roundWinnerIds: [],
    round: 0,
    activeSeatId: players.find((p) => p.isHost)?.id ?? players[0]?.id ?? null,
    usedPromptIds: [],
    promptDeck: buildVariedPromptDeck(prompts, opts?.avoidPromptIds ?? []),
    promptDeckPos: 0,
    answerDeck: buildPreShuffledAnswerDeck(
      answers,
      opts?.avoidAnswerIds ?? [],
      3
    ),
    answerDeckPos: 0,
    discardRoundCompleted: false,
    discardDonePlayerIds: [],
    lastDiscarded: [],
    updatedAt: now(),
  };
  return startGame(reset);
}

export function getFilledSubmission(
  state: GameState,
  submission: Submission
): string {
  const prompt = state.currentPrompt?.text ?? '';
  return fillBlank(
    prompt,
    submission.cards.map((c) => c.text)
  );
}

export function getSubmissionAnswerTexts(
  _state: GameState,
  sub: Submission
): string[] {
  return sub.cards.map((c) => c.text);
}


export function playerById(state: GameState, id: string | null): Player | undefined {
  if (!id) return undefined;
  return state.players.find((p) => p.id === id);
}

/** Snapshot winning combo for historial (call after judgePick). */
export function buildWinningHistorySnapshot(state: GameState): {
  promptText: string;
  answers: string[];
  filledText: string;
  packs: string[];
  round: number;
  gameCode: string;
} | null {
  if (!state.roundWinnerId || !state.currentPrompt) return null;
  const sub = state.submissions.find((s) => s.playerId === state.roundWinnerId);
  if (!sub) return null;
  return {
    promptText: state.currentPrompt.text,
    answers: sub.cards.map((c) => c.text),
    filledText: getFilledSubmission(state, sub),
    packs: state.packIds,
    round: state.round,
    gameCode: state.code,
  };
}/* see following push */
