import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Button,
  CardFace,
  cardFontSize,
  FilledPromptText,
  Label,
  Loading,
  Muted,
  PC_CARD_FONT,
  PC_CARD_FONT_HD,
  Screen,
  Subtitle,
  Title,
} from '@/src/components/ui';
import { NextRoundBar } from '@/src/components/NextRoundBar';
import { leagueMatchCountOf } from '@/src/store/leagueSession';import { AdvanceRoundButton } from '@/src/components/AdvanceRoundButton';
import { WaitingRoster } from '@/src/components/WaitingRoster';
import { HostRecoveryLinks } from '@/src/components/ClaimSeat';
import { RoundStandings } from '@/src/components/RoundStandings';
import { WinnerScreenFlash } from '@/src/components/WinFlash';import { TelegramPlane } from '@/src/components/TelegramPlane';
import * as Engine from '@/src/engine/game';
import { castVoteFlexible, showOwnAnswerWhenVoting } from '@/src/engine/vote2p';
import { DISCARD_COUNT, DISCARD_MIN, DISCARD_MAX, SOLO_MAX_ROUNDS, shouldDiscardBeforeRound, type Card } from '@/src/engine/types';
import { remapGameCards, useAdmin } from '@/src/store/AdminContext';
import { useGameStore } from '@/src/store/GameContext';
import {
  claimSeat,
  getMySeat,
  getOnlineFlag,
  pullRoom,
  pushRoom,
  setMySeat,
  setOnlineFlag,
} from '@/src/store/roomSync';
import { useRoomPoll } from '@/src/store/useRoomPoll'; import { useHistoryStore } from '@/src/store/HistoryContext';
import { useTheme } from '@/src/store/ThemeContext';

function rivalLabel(playerId: string): string {
  const m = /^rival-(\d+)$/.exec(playerId);
  if (m) return `RESPUESTA BOT ${m[1]}`;
  return 'RESPUESTA BOT';
}

export default function PlayScreen() {
  const styles = usePlayStyles();
  const { patches: adminPatches } = useAdmin();

  const { code, seat: seatParam } = useLocalSearchParams<{ code: string; seat?: string }>();
  const router = useRouter();
  const { getGame, updateGame, ready, applyRemoteGame } = useGameStore();
  const {
    appendWinner,
    toggleFavorite,
    winningHistory,
    recordDiscards,
    addFavoriteAnswer,
    deleteFavoriteAnswer,
    favoriteAnswers,
    recordDrawn,
    recordPlayed,
    recordDiscarded,
    recordUnmarkedForcedDiscard,
    recordLeftInHand,
    recordFavoriteMark,
  } = useHistoryStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [forcedDiscardIds, setForcedDiscardIds] = useState<string[]>([]);
  const [soloSkipMode, setSoloSkipMode] = useState(false);
  const { width: winW, height: winH } = useWindowDimensions();
  const [privacy, setPrivacy] = useState(true);
  const lastSeatPrivacyRef = useRef<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const autoRevealKeyRef = useRef<string | null>(null);
  const autoRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continueRoundRef = useRef<((opts?: { hostFallback?: boolean }) => void) | null>(null);
  const [onlineRoom, setOnlineRoom] = useState(false);
  const [lastHistoryId, setLastHistoryId] = useState<string | null>(null);
  /** Show ★ filled briefly before advancing after favoriting */
  const [favJustSaved, setFavJustSaved] = useState(false);
  /** Optimistic phase so UI reacts this frame; engine runs after paint */
  const [paintPhase, setPaintPhase] = useState<string | null>(null);
  const [advancingRound, setAdvancingRound] = useState(false);
  const [replacedSlots, setReplacedSlots] = useState<number[]>([]);
  const replaceFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashGreenIds, setFlashGreenIds] = useState<string[]>([]);
  const greenFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advancingLockRef = useRef(false);
  const engineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRoundRef = useRef<string | null>(null);
  const discardRecordedRef = useRef<string | null>(null);
  const discardSeedKeyRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const knownHandIdsRef = useRef<Set<string>>(new Set());
  /** New draws often land while judging — flash when mano is visible again. */
  const pendingNewCardIdsRef = useRef<string[]>([]);
  const handTrackGameRef = useRef<string>('');
  const staleRecordedRef = useRef<string | null>(null);

  const gameCode = code ? String(code).toUpperCase() : '';
  const rawGame = ready && gameCode ? getGame(gameCode) : undefined;
  const game = useMemo(
    () => (rawGame ? remapGameCards(rawGame, adminPatches) : undefined),
    [rawGame, adminPatches]
  );

  // Online seat lock + room poll (async + KV)
  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    void (async () => {
      const [seat, online] = await Promise.all([
        getMySeat(gameCode),
        getOnlineFlag(gameCode),
      ]);
      if (cancelled) return;
      setMyPlayerId(seat);
      setOnlineRoom(online);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameCode]);

  // Deep-link /play?code=&seat= → reclaim seat and stay on the live board
  const seatClaimRan = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !gameCode) return;
    const want = String(seatParam ?? '').trim();
    if (!want) return;
    const key = `${gameCode}:${want}`;
    if (seatClaimRan.current === key) return;
    seatClaimRan.current = key;
    let cancelled = false;
    void (async () => {
      await setOnlineFlag(gameCode, true);
      setOnlineRoom(true);
      const claimed = await claimSeat(gameCode, want);
      if (cancelled) return;
      if (claimed.ok) {
        await setMySeat(gameCode, claimed.playerId);
        setMyPlayerId(claimed.playerId);
        applyRemoteGame(claimed.state);
        return;
      }
      const pulled = await pullRoom(gameCode);
      if (cancelled || !pulled.ok) return;
      applyRemoteGame(pulled.state);
      if (pulled.state.players.some((p) => p.id === want)) {
        await setMySeat(gameCode, want);
        setMyPlayerId(want);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, gameCode, seatParam, applyRemoteGame]);

     useRoomPoll({
    ready,
    code: gameCode,
    enabled: onlineRoom,
    phase: game?.phase,
    applyRemoteGame,
  });

  useEffect(() => {
    // En rondas múltiplo de 5 no hay descartar/pasar (fase de descarte aparte).
    if (game?.round != null && shouldDiscardBeforeRound(game.round, game.mode) && soloSkipMode) {
      setSoloSkipMode(false);
      setPicked([]);
    }
  }, [game?.round, soloSkipMode]);
  const isSolo = game?.mode === 'solo';
  const phase = paintPhase ?? game?.phase;
  const isDiscarding = phase === 'discarding';

  useEffect(() => {
    if (!game) return;
    if (game.phase === 'results') {
      router.replace({ pathname: '/results', params: { code: game.code } });
    } else if (game.phase === 'lobby') {
      router.replace({ pathname: '/lobby', params: { code: game.code } });
    }
  }, [game, router]);

  useEffect(() => {
    if (game?.phase !== 'reveal') {
      setFavJustSaved(false);
      advancingLockRef.current = false;
      if (favAdvanceTimerRef.current) {
        clearTimeout(favAdvanceTimerRef.current);
        favAdvanceTimerRef.current = null;
      }
    }
    if (paintPhase && game?.phase === paintPhase) {
      setPaintPhase(null);
      setAdvancingRound(false);
    }
    // Drop local pick once the engine owns the fill (reveal) or a new round starts
    if (game?.phase === 'reveal' || game?.phase === 'submitting') {
      // Only clear on submitting when this round's submission is gone (new round)
      if (game.phase === 'submitting' && !game.submissions.length) {
        setPicked([]);
      }
    }
  }, [game?.phase, game?.round, game?.submissions?.length, paintPhase]);

  useEffect(() => {
    return () => {
      if (favAdvanceTimerRef.current) clearTimeout(favAdvanceTimerRef.current);
      if (engineTimerRef.current) clearTimeout(engineTimerRef.current);
      if (replaceFlashRef.current) clearTimeout(replaceFlashRef.current);
      if (greenFlashRef.current) clearTimeout(greenFlashRef.current);
    };
  }, []);

  // Track cards entering human (non-bot) hands → drawn + hold start
  useEffect(() => {
    if (!game) return;
    if (handTrackGameRef.current !== game.code) {
      knownHandIdsRef.current = new Set();
      handTrackGameRef.current = game.code;
      staleRecordedRef.current = null;
    }
    const hadCardsBefore = knownHandIdsRef.current.size > 0;
    const newly: { id: string; text: string; kind: 'answer' }[] = [];
    for (const p of game.players) {
      if (p.isBot) continue;
      for (const c of p.hand) {
        if (knownHandIdsRef.current.has(c.id)) continue;
        knownHandIdsRef.current.add(c.id);
        newly.push({ id: c.id, text: c.text, kind: 'answer' });
      }
    }
    if (newly.length) recordDrawn(newly);
    // Cartas nuevas (mismo hueco vía replaceInHand). Si la mano no se ve aún
    // (judging/reveal), guardamos ids y flasheamos al volver a submitting.
    if (newly.length && hadCardsBefore) {
      const ids = newly.map((c) => c.id);
      if (game.phase === 'submitting' || game.phase === 'discarding') {
        pendingNewCardIdsRef.current = [];
        const slots: number[] = [];
        const human = game.players.find((pl) => !pl.isBot) ?? game.players[0];
        const h = human?.hand ?? [];
        ids.forEach((id) => {
          const i = h.findIndex((c) => c.id === id);
          if (i >= 0) slots.push(i);
        });
        if (slots.length) {
          setReplacedSlots(slots);
          if (replaceFlashRef.current) clearTimeout(replaceFlashRef.current);
          replaceFlashRef.current = setTimeout(() => setReplacedSlots([]), 1000);
        }
        setFlashGreenIds(ids);
        if (greenFlashRef.current) clearTimeout(greenFlashRef.current);
        greenFlashRef.current = setTimeout(() => {
          greenFlashRef.current = null;
          setFlashGreenIds([]);
        }, 1000);
      } else {
        pendingNewCardIdsRef.current = ids;
      }
    }
  }, [game, recordDrawn]);

  // Flash letras verdes 1s al empezar ronda si hubo robos en judging
  useEffect(() => {
    if (!game || game.phase !== 'submitting') return;
    const ids = pendingNewCardIdsRef.current;
    if (!ids.length) return;
    pendingNewCardIdsRef.current = [];
    const human = game.players.find((pl) => !pl.isBot) ?? game.players[0];
    const h = human?.hand ?? [];
    const slots: number[] = [];
    ids.forEach((id) => {
      const i = h.findIndex((c) => c.id === id);
      if (i >= 0) slots.push(i);
    });
    if (slots.length) {
      setReplacedSlots(slots);
      if (replaceFlashRef.current) clearTimeout(replaceFlashRef.current);
      replaceFlashRef.current = setTimeout(() => setReplacedSlots([]), 1000);
    }
    setFlashGreenIds(ids);
    if (greenFlashRef.current) clearTimeout(greenFlashRef.current);
    greenFlashRef.current = setTimeout(() => {
      greenFlashRef.current = null;
      setFlashGreenIds([]);
    }, 1000);
  }, [game?.phase, game?.round, game?.code]);

  // Left in hand at match end (once per game)
  useEffect(() => {
    if (!game) return;
    if (phase !== 'results') return;
    const key = `${game.code}:stale`;
    if (staleRecordedRef.current === key) return;
    staleRecordedRef.current = key;
    const left: { id: string; text: string; kind: 'answer' }[] = [];
    for (const p of game.players) {
      if (p.isBot) continue;
      for (const c of p.hand) {
        left.push({ id: c.id, text: c.text, kind: 'answer' });
      }
    }
    if (left.length) recordLeftInHand(left);
  }, [game, recordLeftInHand]);

  // Record discard stats when leaving discarding → submitting
  useEffect(() => {
    if (!game) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = game.phase;
    if (
      prev === 'discarding' &&
      game.phase === 'submitting' &&
      game.discardRoundCompleted
    ) {
      const key = `${game.code}:discard:r${game.round}`;
      if (discardRecordedRef.current === key) return;
      discardRecordedRef.current = key;
      const cards = Engine.flushDiscardedCards(game).map((c) => ({
        id: c.id,
        text: c.text,
        kind: 'answer' as const,
      }));
      if (cards.length) {
        recordDiscards(cards);
        recordDiscarded(cards);
      }
    }
  }, [
    game?.phase,
    game?.discardRoundCompleted,
    game?.code,
    game?.lastDiscarded,
    game,
    recordDiscards,
    recordDiscarded,
  ]);

  // Auto-append winning combo to favoritas/recientes on reveal/results
  useEffect(() => {
    if (!game) return;
    if (phase !== 'reveal' && phase !== 'results') return;
    if (!game.roundWinnerId) return;
    const key = `${game.code}:${game.round}:${game.roundWinnerId}`;
    if (recordedRoundRef.current === key) return;
    recordedRoundRef.current = key;

    const snap = Engine.buildWinningHistorySnapshot(game);
    if (!snap) return;

    void appendWinner(snap).then((entry) => {
      setLastHistoryId(entry.id);
    });
  }, [
    phase,
    game?.roundWinnerId,
    game?.round,
    game?.code,
    appendWinner,
    game,
  ]);

  // Solo / online: no pass-the-phone. Pass-and-play: re-ask only when seat changes
  // (never mid pick×2 on the same seat).
  useEffect(() => {
    if (isSolo || onlineRoom) {
      setPrivacy(false);
      lastSeatPrivacyRef.current = game?.activeSeatId ?? null;
      return;
    }
    const seat = game?.activeSeatId ?? null;
    if (seat !== lastSeatPrivacyRef.current) {
      lastSeatPrivacyRef.current = seat;
      setPrivacy(true);
      setPicked([]);
    }
  }, [isSolo, onlineRoom, game?.activeSeatId]);

  // Persist shuffled revealOrder if somehow missing while judging
  useEffect(() => {
    if (!game || game.phase !== 'judging') return;
    const ensured = Engine.ensureRevealOrder(game);
    if (
      JSON.stringify(ensured.revealOrder) !==
      JSON.stringify(game.revealOrder ?? [])
    ) {
      updateGame(game.code, () => ensured);
    }
  }, [
    game?.phase,
    game?.code,
    game?.submissions.length,
    game?.revealOrder,
    updateGame,
    game,
  ]);

  // Round-5 discard: auto-preselect DISCARD_MIN random forced cards per seat
  useEffect(() => {
    if (!game || phase !== 'discarding') {
      if (discardSeedKeyRef.current != null) {
        discardSeedKeyRef.current = null;
        setForcedDiscardIds([]);
      }
      return;
    }
    const seatId =
      game.mode === 'solo'
        ? (game.players.find((p) => !p.isBot) ?? game.players[0])?.id
        : onlineRoom && myPlayerId
          ? myPlayerId
          : game.activeSeatId;
    if (!seatId) return;
    if (game.discardDonePlayerIds.includes(seatId)) return;
    const player = game.players.find((p) => p.id === seatId);
    if (!player || player.isBot) return;
    const key = `${game.code}:discard:r${game.round}:${seatId}`;
    if (discardSeedKeyRef.current === key) return;
    discardSeedKeyRef.current = key;
    const ids = player.hand.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    const n = Math.min(DISCARD_MIN, ids.length);
    const forced = ids.slice(0, n);
    setForcedDiscardIds(forced);
    setPicked(forced);
  }, [
    phase,
    game?.code,
    game?.activeSeatId,
    game?.mode,
    game?.discardDonePlayerIds,
    game?.players,
    game,
    onlineRoom,
    myPlayerId,
  ]);

  // Online reveal: only the next Zar (winner) auto-advances at 10s.
  // Others wait for poll. Host fallback at 12s if still stuck on reveal.
  useEffect(() => {
    if (!game || game.mode === 'solo') return;
    if (game.phase !== 'reveal') { // 421.14 annul ties
      if (autoRevealTimerRef.current) {
        clearTimeout(autoRevealTimerRef.current);
        autoRevealTimerRef.current = null;
      }
      if (game?.phase !== 'reveal') autoRevealKeyRef.current = null;
      return;
    }
    const online = onlineRoom && !!myPlayerId;
    const iAmNextZar = online && myPlayerId === game.roundWinnerId;
    const iAmHost =
      online &&
      !!game.players.find((p) => p.id === myPlayerId && p.isHost);
    // Pass-and-play (one device): anyone may auto-advance
    const mayAuto = true;
    const key = `${game.code}:${game.round}:${game.roundWinnerId ?? 'annul'}:${(game.roundWinnerIds ?? []).join(',')}:${
      mayAuto ? 'zar' : iAmHost ? 'host' : 'wait'
    }`;
    if (autoRevealKeyRef.current === key) return;
    autoRevealKeyRef.current = key;
    if (autoRevealTimerRef.current) clearTimeout(autoRevealTimerRef.current);

    if (mayAuto) {
      autoRevealTimerRef.current = setTimeout(() => {
        autoRevealTimerRef.current = null;
        continueRoundRef.current?.();
      }, 8000);
      return;
    }
    if (iAmHost) {
      autoRevealTimerRef.current = setTimeout(() => {
        autoRevealTimerRef.current = null;
        continueRoundRef.current?.({ hostFallback: true });
      }, 12000);
    }
  }, [
    game?.mode,
    game?.phase,
    game?.code,
    game?.round,
    game?.roundWinnerId,
    game?.roundWinnerIds,
    game?.players,
    onlineRoom,
    myPlayerId,
  ]);

  if (!ready) return <Loading />;

  if (!game) {
    return (
      <Screen>
        <Title>Partida no encontrada</Title>
        <Button title="Inicio" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (game.phase === 'results' || game.phase === 'lobby') {
    return <Loading />;
  }

  const human = game.players.find((p) => !p.isBot) ?? game.players[0];
  const isOnline = !isSolo && onlineRoom && !!myPlayerId;
  const iAmHostPlayer =
    !!myPlayerId &&
    !!game.players.find((p) => p.id === myPlayerId && p.isHost);
  const onlineMissingSeat = !isSolo && onlineRoom && !myPlayerId;
  // Solo: human seat. Online: locked seat ONLY (never fall back to shared activeSeatId).
  const active = isSolo
    ? human
    : isOnline
      ? Engine.playerById(game, myPlayerId)
      : onlineMissingSeat
        ? undefined
        : Engine.playerById(game, game.activeSeatId);
  if (onlineMissingSeat) {
    return (
      <Screen>
        <Title>Sin asiento</Title>
        <Subtitle>
          Esta ventana no tiene jugador propio en la sala. Vuelve a Inicio y usa
          «Unirse a partida async» (cada invitado necesita su propia unión).
        </Subtitle>
        <Button title="Inicio" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const zar = game.players[game.zarIndex];

  const voteMode = (game.judgeMode ?? 'zar') === 'vote';
  const zarSkipsSubmit = !isSolo && !voteMode;
  const submitNeeded = voteMode
    ? game.players.length
    : Math.max(0, game.players.length - 1);

  const roundSubs = Engine.submissionsForRound(game);
  const votesMap = game.votes ?? {};
  const votersPending = voteMode
    ? game.submissions
        .filter((s) => !s.rival)
        .map((s) => s.playerId)
        .filter((id) => !votesMap[id])
    : [];
  const submitPendingPlayers = game.players.filter((p) => {
    if (zarSkipsSubmit && p.id === zar.id) return false;
    return !roundSubs.some((s) => s.playerId === p.id && !s.rival);
  });
  // Prefer engine revealOrder (set on enter judging). Stable identity fallback only.
  const revealOrderSafe =
    game.revealOrder.length === game.submissions.length &&
    game.revealOrder.every(
      (i) => i >= 0 && i < game.submissions.length
    ) &&
    new Set(game.revealOrder).size === game.submissions.length
      ? game.revealOrder
      : game.submissions.map((_, i) => i);
  const handLenForPick = active?.hand.length ?? 0;
  const discardMin = Math.min(DISCARD_MIN, handLenForPick);
  const discardMax = Math.min(DISCARD_MAX, handLenForPick);
  const pickNeed =
    isDiscarding
      ? discardMax
      : isSolo && soloSkipMode
        ? Math.min(DISCARD_COUNT, handLenForPick)
        : Math.max(1, game.currentPrompt?.pick ?? 1);
  const hand = active?.hand ?? [];
  const handCount = Math.max(1, hand.length);
  const handGap = 6;
  const handPad = 32; // scrollInner horizontal padding
  // 12 cards: mobile 2x6; PC prefer 6x2. Wide/fullscreen locks 6 cols.
  const isPcHand = winW >= 700;
  const hdPcHand = isPcHand && (winW >= 1600 || winH >= 1000);
  const lockSixCols = isPcHand && winW >= 1100;
  const fontForCols = (cols: number) => {
    // Reserve scrollbar so 6 fixed widths don't wrap to 5 after answering.
    const availW = Math.max(320, winW - handPad - (isPcHand ? 18 : 0));
    const itemW = Math.max(
      72,
      Math.floor((availW - handGap * (cols - 1)) / cols)
    );
    const contentH = Math.max(
      40,
      itemW / 1.35 - (isPcHand ? 5 : 6) * 2 - (isPcHand ? 2 : 4)
    );
    const base = isPcHand ? (hdPcHand ? PC_CARD_FONT_HD : PC_CARD_FONT) : 16;
    if (!hand.length) return { cols, itemW, size: base };
    let minSz = base;
    for (const c of hand) {
      const f = cardFontSize(c.text, Math.max(48, itemW - 10), {
        square: true,
        uniformPc: isPcHand,
        hdPc: hdPcHand,
        contentHeight: contentH,
      });
      if (f.fontSize < minSz) minSz = f.fontSize;
    }
    return { cols, itemW, size: minSz };
  };
  const handLayout = (() => {
    if (!isPcHand) return fontForCols(2);
    if (lockSixCols) return fontForCols(6);
    const six = fontForCols(6);
    const minOk = hdPcHand ? 17 : 15;
    if (six.size >= minOk) return six;
    return fontForCols(4);
  })();
  const handColumns = handLayout.cols;
  const handItemWidth = handLayout.itemW;
  const handFontSize = handLayout.size;
  const handItemLayoutStyle = {
    width: `calc((100% - ${handGap * (handColumns - 1)}px) / ${handColumns})` as unknown as number,
  };

  const alreadyAnswered =
    !!active &&
    (isDiscarding
      ? game.discardDonePlayerIds.includes(active.id)
      : roundSubs.some((s) => s.playerId === active.id && !s.rival));

  const pickedCards = picked
    .map((id) => hand.find((c) => c.id === id))
    .filter(Boolean) as { id: string; text: string }[];

  const liveAnswerTexts = [
    ...pickedCards.map((c) => c.text),
    ...Array(Math.max(0, pickNeed - pickedCards.length)).fill('______'),
  ];

  const mySubmitted = active
    ? roundSubs.find((s) => s.playerId === active.id && !s.rival)
    : undefined;

  const submittedAnswerTexts = mySubmitted
    ? Engine.getSubmissionAnswerTexts(game, mySubmitted)
    : [];

  const stickyAnswers =
    alreadyAnswered && submittedAnswerTexts.length
      ? submittedAnswerTexts
      : liveAnswerTexts;

  const runEngineAfterPaint = (fn: () => void) => {
    if (engineTimerRef.current) clearTimeout(engineTimerRef.current);
    // Two rAFs ≈ after the browser/RN has committed the optimistic UI
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        engineTimerRef.current = setTimeout(() => {
          engineTimerRef.current = null;
          fn();
        }, 0);
      });
    });
  };

  const flashAnswerGreen = (ids: string[]) => {
    if (!ids.length) return;
    setFlashGreenIds(ids);
    if (greenFlashRef.current) clearTimeout(greenFlashRef.current);
    greenFlashRef.current = setTimeout(() => {
      greenFlashRef.current = null;
      setFlashGreenIds([]);
    }, 1000);
  };

  const autoSend = (ids: string[]) => {
    if (!active) return;
    const pickedCards = ids
      .map((id) => hand.find((c) => c.id === id))
      .filter(Boolean) as { id: string; text: string }[];
    const cardRefs = pickedCards.map((c) => ({
      id: c.id,
      text: c.text,
      kind: 'answer' as const,
    }));
    const discarding = isDiscarding;
    const skipMode = isSolo && soloSkipMode;
    const code = game.code;
    const pid = active.id;
    const solo = isSolo;
    if (discarding) setForcedDiscardIds([]);
    // Don't hide the hand here: for pick≥2 it re-asks «¿Eres…?» mid-answer.
    // Privacy flips after a successful submit when the seat actually changes.
    if (skipMode) setSoloSkipMode(false);

    if (discarding) {
      // Capture slots so the new cards flash “NUEVA” after the swap
      const slots = ids
        .map((id) => hand.findIndex((c) => c.id === id))
        .filter((i) => i >= 0);
      // 5th red + DESCARTE paints first, then next round + new prompt
      runEngineAfterPaint(() => {
        if (engineTimerRef.current) clearTimeout(engineTimerRef.current);
        engineTimerRef.current = setTimeout(() => {
          engineTimerRef.current = null;
          setPicked([]);
          try {
            updateGame(code, (g) => Engine.submitDiscard(g, pid, ids));
            if (!solo) {
              const after = getGame(code);
              if (after?.activeSeatId && after.activeSeatId !== pid) {
                setPrivacy(true);
              }
            }
            setReplacedSlots(slots);
            if (replaceFlashRef.current) clearTimeout(replaceFlashRef.current);
      if (greenFlashRef.current) clearTimeout(greenFlashRef.current);
            replaceFlashRef.current = setTimeout(() => {
              replaceFlashRef.current = null;
              setReplacedSlots([]);
            }, 700);
          } catch (e) {
            Alert.alert('Descarte', e instanceof Error ? e.message : 'Error');
          }
        }, 160);
      });
      return;
    }

    // Answer path: keep `picked` so the sticky fills on this press, show it,
    // then commit. Reveal keeps the same filled text.
    runEngineAfterPaint(() => {
      if (engineTimerRef.current) clearTimeout(engineTimerRef.current);
      engineTimerRef.current = setTimeout(() => {
        engineTimerRef.current = null;
        void (async () => {
          try {
            if (skipMode) {
              updateGame(code, (g) => Engine.soloSkipRoundDiscard(g, pid, ids));
              if (cardRefs.length) {
                recordDiscards(cardRefs);
                recordDiscarded(cardRefs);
              }
              setPicked([]);
            } else {
              if (onlineRoom) {
                try {
                  const remote = await pullRoom(code);
                  if (remote.ok) applyRemoteGame(remote.state);
                } catch {
                  // keep local
                }
              }
              updateGame(code, (g) => Engine.submitCards(g, pid, ids));
              if (cardRefs.length) {
                recordPlayed(cardRefs, { won: solo });
              }
              if (onlineRoom) {
                const afterPush = getGame(code);
                if (afterPush) {
                  void pushRoom(afterPush, myPlayerId || pid);
                }
              }
              if (!solo) {
                const after = getGame(code);
                if (after?.activeSeatId && after.activeSeatId !== pid) {
                  setPrivacy(true);
                  setPicked([]);
                }
              }
            }
          } catch (e) {
            Alert.alert(
              skipMode ? 'Descarte' : 'Enviar',
              e instanceof Error ? e.message : 'Error'
            );
          }
        })();
      }, 140);
    });
  };

  const toggleDiscardMark = (id: string) => {
    if (!active || alreadyAnswered || active.isBot) return;
    if (picked.includes(id)) {
      if (forcedDiscardIds.includes(id)) {
        const card = hand.find((c) => c.id === id);
        if (card) {
          recordUnmarkedForcedDiscard([
            { id: card.id, text: card.text, kind: 'answer' },
          ]);
        }
      }
      setPicked(picked.filter((x) => x !== id));
      return;
    }
    if (picked.length >= discardMax) return;
    const next = [...picked, id];
    setPicked(next);
    // At max (5): auto-confirm and continue the round
    if (next.length >= discardMax) {
      autoSend(next);
    }
  };

  const pickCard = (id: string) => {
    if (!active || alreadyAnswered || active.isBot) return;
    if (isDiscarding) {
      toggleDiscardMark(id);
      return;
    }
    let next: string[];
    if (picked.includes(id)) {
      next = picked.filter((x) => x !== id);
      setPicked(next);
      return;
    }
    if (pickNeed <= 1) {
      next = [id];
      setPicked(next);
      if (!soloSkipMode) flashAnswerGreen(next);
      autoSend(next);
      return;
    }
    // Multipick / solo-skip: keep earlier marks
    next =
      picked.length >= pickNeed
        ? [...picked.slice(1), id]
        : [...picked, id];
    setPicked(next);
    if (!soloSkipMode) flashAnswerGreen(next);
    if (next.length >= pickNeed) {
      autoSend(next.slice(0, pickNeed));
    }
  };

  const recordIfNeeded = (next: ReturnType<typeof Engine.judgePick>) => {
    if (next.roundWinnerId && (next.phase === 'reveal' || next.phase === 'results')) {
      const snap = Engine.buildWinningHistorySnapshot(next);
      if (snap) {
        const key = `${next.code}:${next.round}:${next.roundWinnerId}`;
        if (recordedRoundRef.current !== key) {
          recordedRoundRef.current = key;
          void appendWinner(snap).then((entry) => setLastHistoryId(entry.id));
        }
      }
    }
  };

  const judge = (winnerId: string) => {
    try {
      const winningSub = game.submissions.find((s) => s.playerId === winnerId);
      updateGame(game.code, (g) => {
        const next = Engine.judgePick(g, winnerId);
        recordIfNeeded(next);
        if (next.phase === 'results') {
          setTimeout(() => {
            router.replace({ pathname: '/results', params: { code: g.code } });
          }, 0);
        }
        return next;
      });
      // Late win bump (timesPlayed already recorded at submit)
      if (winningSub && !winningSub.rival) {
        recordPlayed(
          winningSub.cards.map((c) => ({
            id: c.id,
            text: c.text,
            kind: 'answer' as const,
          })),
          { won: true }
        );
      }
    } catch (e) {
      Alert.alert('Zar', e instanceof Error ? e.message : 'Error');
    }
  };

  const castVote = (submissionPlayerId: string) => {
    if (!active) return;
    try {
      updateGame(game.code, (g) => {
        const next = castVoteFlexible(g, active.id, submissionPlayerId);
        recordIfNeeded(next);
        if (next.phase === 'results') {
          setTimeout(() => {
            router.replace({ pathname: '/results', params: { code: g.code } });
          }, 0);
        }
        return next;
      });
      if (!isSolo) setPrivacy(true);
      const after = getGame(game.code);
      if (
        after &&
        (after.phase === 'reveal' || after.phase === 'results') &&
        after.roundWinnerId
      ) {
        const winningSub = after.submissions.find(
          (s) => s.playerId === after.roundWinnerId && !s.rival
        );
        if (winningSub) {
          recordPlayed(
            winningSub.cards.map((c) => ({
              id: c.id,
              text: c.text,
              kind: 'answer' as const,
            })),
            { won: true }
          );
        }
      }
    } catch (e) {
      { const msg = e instanceof Error ? e.message : 'Error';
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(`Voto: ${msg}`);
      else Alert.alert('Voto', msg); }
    }
  };

  /** Online: only next Zar advances (pull first). Offline pass-and-play: anyone. */
  const continueRound = (opts?: { hostFallback?: boolean }) => {
    if (favAdvanceTimerRef.current) {
      clearTimeout(favAdvanceTimerRef.current);
      favAdvanceTimerRef.current = null;
    }
    if (autoRevealTimerRef.current) {
      clearTimeout(autoRevealTimerRef.current);
      autoRevealTimerRef.current = null;
    }
    if (advancingLockRef.current) return;
    advancingLockRef.current = true;
    setFavJustSaved(false);
    setPicked([]);
    setSoloSkipMode(false);
    setLastHistoryId(null);
    if (!isSolo) setPrivacy(true);
    setPaintPhase(null);
    setAdvancingRound(false);

    const run = async () => {
      try {
        if (onlineRoom && myPlayerId) {
          const pulled = await pullRoom(game.code);
          if (pulled.ok) applyRemoteGame(pulled.state);
          const cur = getGame(game.code);
          if (!cur || cur.phase !== 'reveal') {
            advancingLockRef.current = false;
            return;
          }
          const vote = (cur.judgeMode ?? 'zar') === 'vote';
          const iAmNextZar =
            !!cur.roundWinnerId && myPlayerId === cur.roundWinnerId;
          const iAmHost = !!cur.players.find(
            (p) => p.id === myPlayerId && p.isHost
          );
                    const mayAdvance =
            iAmNextZar || (!!opts?.hostFallback && iAmHost);
          if (!mayAdvance) {
            advancingLockRef.current = false;
            return;
          }
        }
        updateGame(game.code, (g) => {
          if (g.phase !== 'reveal') return g;
          return Engine.nextRound(g);
        });
      } catch (e) {
        advancingLockRef.current = false;
        autoRevealKeyRef.current = null;
        const msg = e instanceof Error ? e.message : 'Error';
        if (/revelado/i.test(msg)) return;
        if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(`Siguiente: ${msg}`);
        else Alert.alert('Siguiente', msg);
      }
    };
    void run();
  };

  continueRoundRef.current = continueRound;

  const historyEntry = lastHistoryId
    ? winningHistory.find((h) => h.id === lastHistoryId)
    : undefined;

  const isFavFilled = (filled: string) =>
    favoriteAnswers.some((a) => a.text === filled.trim());

  const toggleFavFilled = (
    filled: string,
    cards?: { id: string; text: string }[]
  ) => {
    const t = filled.trim();
    if (!t) return;
    const existing = favoriteAnswers.find((a) => a.text === t);
    if (existing) {
      deleteFavoriteAnswer(existing.id);
    } else {
      addFavoriteAnswer(t, {
        promptText: game.currentPrompt?.text,
        answers: cards?.map((c) => c.text),
      });
      if (cards) {
        for (const c of cards) {
          recordFavoriteMark(c.id, c.text);
        }
      }
    }
  };

  const winnerSub = game.roundWinnerId
    ? game.submissions.find((s) => s.playerId === game.roundWinnerId)
    : undefined;
  const winnerIsRival = !!winnerSub?.rival || !!game.roundWinnerId?.startsWith('rival-');
  const winnerName = winnerIsRival
    ? rivalLabel(game.roundWinnerId ?? '')
    : game.players.find((p) => p.id === game.roundWinnerId)?.nickname ?? '—';

  const selectionIndexFor = (cardId: string): number | undefined => {
    const idx = picked.indexOf(cardId);
    return idx >= 0 ? idx + 1 : undefined;
  };

  const myRevealSub =
    human && phase === 'reveal'
      ? game.submissions.find((s) => s.playerId === human.id && !s.rival) ??
        game.submissions.find((s) => s.playerId === human.id)
      : undefined;
  const myRevealFilled = myRevealSub
    ? Engine.getFilledSubmission(game, myRevealSub)
    : '';
  const myAnswerFav =
    (!!myRevealFilled && isFavFilled(myRevealFilled)) ||
    !!historyEntry?.favorite;
  const starFilled = myAnswerFav || favJustSaved;

  const persistMyAnswerFavorite = (turningOn: boolean) => {
    if (lastHistoryId && !!historyEntry?.favorite !== turningOn) {
      toggleFavorite(lastHistoryId);
    }
    if (myRevealSub && myRevealFilled) {
      if (isFavFilled(myRevealFilled) !== turningOn) {
        toggleFavFilled(myRevealFilled, myRevealSub.cards);
      }
    } else if (turningOn && winnerSub) {
      const wFilled = Engine.getFilledSubmission(game, winnerSub);
      if (wFilled && !isFavFilled(wFilled)) {
        toggleFavFilled(wFilled, winnerSub.cards);
      }
    }
  };

  const scheduleAdvanceAfterFav = () => {
    if (favAdvanceTimerRef.current) clearTimeout(favAdvanceTimerRef.current);
    favAdvanceTimerRef.current = setTimeout(() => {
      favAdvanceTimerRef.current = null;
      continueRound();
    }, 90);
  };

  const toggleMyAnswerFav = () => {
    if (favJustSaved || advancingLockRef.current) return;
    const turningOn = !starFilled;
    if (!turningOn) {
      setFavJustSaved(false);
      persistMyAnswerFavorite(false);
      return;
    }
    // Paint ★, persist, then advance (same as Añadir favorito)
    setFavJustSaved(true);
    requestAnimationFrame(() => {
      persistMyAnswerFavorite(true);
      if (phase === 'reveal') scheduleAdvanceAfterFav();
    });
  };

  /** Big “Añadir favorito” — save + pasar a siguiente ronda. */
  const saveAnswerKeep = () => {
    if (starFilled || favJustSaved || advancingLockRef.current) return;
    setFavJustSaved(true);
    requestAnimationFrame(() => {
      persistMyAnswerFavorite(true);
      if (phase === 'reveal') scheduleAdvanceAfterFav();
    });
  };

  const openShareAnswer = () => {
    if (!myRevealSub || !myRevealFilled) return;
    router.push({
      pathname: '/compartir',
      params: {
        promptText: game.currentPrompt?.text ?? '',
        answers: JSON.stringify(myRevealSub.cards.map((c) => c.text)),
        filledText: myRevealFilled,
      },
    });
  };

  const revealShareSaveRow =
    myRevealSub && myRevealFilled ? (
      <View style={styles.revealActionRow}>
        <Pressable
          onPress={openShareAnswer}
          style={styles.shareSquare}
          accessibilityLabel="Enviar"
        >
          <TelegramPlane size={30} />
          <Text style={styles.shareEnviar}>enviar</Text>
        </Pressable>
        <View style={styles.guardarFlex}>
          <Button
            title={starFilled ? 'En favoritos' : 'Añadir favorito'}
            variant={starFilled ? 'ghost' : 'primary'}
            onPress={saveAnswerKeep}
            disabled={starFilled}
            style={{ width: '100%', minHeight: 52, justifyContent: 'center' }}
          />
        </View>
      </View>
    ) : null;

  const stickyPromptVisible =
    !isDiscarding &&
    !!game.currentPrompt &&
    (phase === 'submitting' ||
      phase === 'judging' ||
      phase === 'reveal');

   const stickyPromptAnswers =
    phase === 'reveal'
      ? Array(Math.max(1, game.currentPrompt?.pick ?? 1)).fill('______')
      : phase === 'judging'
        ? stickyAnswers.length
          ? stickyAnswers
          : Array(Math.max(1, game.currentPrompt?.pick ?? 1)).fill('______')
        : stickyAnswers;

  const discardCountLabel =
    picked.length <= discardMin
      ? `${discardMin} Descartes mínimo`
      : `${picked.length}/${discardMax}`;
  // Solo “tirar 2 y saltar”: always n/2
  const soloSkipCountLabel = `${Math.min(picked.length, pickNeed)}/${pickNeed}`;

 const roundLine = isDiscarding
    ? `Descarte · ${discardCountLabel}`
    : soloSkipMode
      ? `Descarte · ${soloSkipCountLabel}`
      : !voteMode &&
          phase === 'submitting' &&
          zar &&
          myPlayerId === zar.id
        ? `ZAR · Ronda ${game.round} · ${game.code}`
                                : `Partida ${(leagueMatchCountOf(game) || 0) + (game.phase === 'results' ? 0 : 1)} · Ronda ${game.round}`;
  const scoreLine = isSolo
    ? `${human?.score ?? 0}/${game.targetScore}`
    : '';
  return (
    <View style={styles.root}>
      <WinnerScreenFlash
        active={phase === 'reveal' && !isSolo && !!myPlayerId && myPlayerId === game.roundWinnerId}
        variant="round"
      />      <View style={styles.sticky}>
                  <NextRoundBar
                    active={phase === 'reveal'}
                    deadlineAt={
                      phase === 'reveal' && game.updatedAt
                        ? game.updatedAt + 8000
                        : null
                    }
                    onDone={() => continueRoundRef.current?.()}
                  />
        <View style={styles.roundSticky}>
          <Text style={styles.roundStickyTitle} numberOfLines={1}>
            {roundLine}
          </Text>
          <Text style={styles.roundStickyScore} numberOfLines={1}>
            {scoreLine}
          </Text>
        </View>
        {isDiscarding && !alreadyAnswered ? (
          <View style={styles.discardCounterBox}>
            <Text style={styles.discardCounterText}>{discardCountLabel}</Text>
            <Text style={styles.discardCounterHint}>
              {picked.length < discardMax
                ? `Marca hasta ${discardMax} · toca cartas en rojo`
                : 'Listo — enviando…'}
            </Text>
          </View>
        ) : null}
        {soloSkipMode && phase === 'submitting' && !alreadyAnswered ? (
          <View style={styles.discardCounterBox}>
            <Text style={styles.discardCounterText}>{soloSkipCountLabel}</Text>
            <Text style={styles.discardCounterHint}>
              {picked.length < pickNeed
                ? `Elige ${pickNeed} cartas en rojo para saltar`
                : 'Listo — saltando ronda…'}
            </Text>
          </View>
        ) : null}
        {stickyPromptVisible ? (
          <View style={[styles.liveBox, styles.liveBoxWithFavSlot]}>
            {/* Same label/layout while answering → reveal so the prompt doesn't jump */}
            <Text style={styles.liveLabel}>
              {soloSkipMode
                ? `Descartar ${soloSkipCountLabel}`
                : pickNeed > 1 && phase === 'submitting' && !alreadyAnswered
                  ? `Elige ${pickNeed} (${picked.length}/${pickNeed})`
                  : 'Pregunta'}
            </Text>
            {!soloSkipMode ? (
              <FilledPromptText
                large
                promptText={game.currentPrompt!.text}
                answers={stickyPromptAnswers}
              />
            ) : (
              <Muted>Elige {pickNeed} cartas para tirar y saltar la ronda</Muted>
            )}
            {/* Star overlays top-right; doesn't shift the question */}
            {phase === 'reveal' ? (
              <Pressable
                onPress={toggleMyAnswerFav}
                hitSlop={12}
                style={styles.revealFavStarAbs}
                accessibilityLabel={
                  myAnswerFav ? 'Respuesta guardada' : 'Marcar favorita'
                }
              >
                <Text style={styles.revealFavStar}>
                  {starFilled ? '★' : '☆'}
                </Text>
              </Pressable>
            ) : null}
            {/* Reserve next-round row height always in solo so reveal doesn't shove the prompt */}
            {isSolo ? (
              <View
                style={[
                  styles.soloCompactBlock,
                  phase !== 'reveal' && styles.soloCompactBlockHidden,
                ]}
                pointerEvents={phase === 'reveal' ? 'auto' : 'none'}
              >
                <Button
                  title="→  Siguiente ronda"
                  variant="success"
                  onPress={continueRound}
                />
                {revealShareSaveRow}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          phase === 'submitting' && styles.scrollInnerTight,
        ]}
        keyboardShouldPersistTaps="handled"
      >

      {!isSolo && !isOnline ? (
        <>
          <Label>Asiento activo (pásame el móvil)</Label>
          <View style={styles.seatRow}>
            {game.players.map((p) => (
              <Button
                key={p.id}
                title={p.nickname}
                variant={game.activeSeatId === p.id ? 'primary' : 'ghost'}
                onPress={() => {
                  setPrivacy(true);
                  setPicked([]);
                  setForcedDiscardIds([]);
                  discardSeedKeyRef.current = null;
                  updateGame(game.code, (g) => Engine.setActiveSeat(g, p.id));
                }}
              />
            ))}
          </View>
        </>
      ) : null}
      {isOnline ? (
        <Muted>
          Tú: {active?.nickname ?? '—'} · online · código {game.code}
        </Muted>
      ) : null}


      {isDiscarding ? (
        <>
          <Subtitle>
            Ronda de descarte (cada 5 rondas) — 2 obligatorias (aleatorias), hasta 5
          </Subtitle>
          <Muted>
            Marcadas en rojo se descartan. Mínimo {discardMin}; al llegar a {discardMax} se envía solo.
            {isSolo
              ? ''
              : ` Completado: ${game.discardDonePlayerIds.length}/${game.players.length}`}
          </Muted>

          {game.discardDonePlayerIds.includes(active?.id ?? '') ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneBadge}>✓ Descarte enviado</Text>
                            {!isSolo ? (
                <WaitingRoster
                  players={game.players}
                  doneIds={game.discardDonePlayerIds}
                  meId={myPlayerId ?? active?.id}
                  verb="descarte"
             />
              ) : null}
            </View>
          ) : privacy && !isSolo && !isOnline ? (
            <>
              <Subtitle>¿Eres {active?.nickname}?</Subtitle>
              <Muted>Ocultamos la mano hasta que confirmes (pass-and-play).</Muted>
              <Button title="Sí, mostrar mi mano" onPress={() => setPrivacy(false)} />
              </>
          ) : (
            <>
              <View style={styles.discardCounterBox}>
                <Text style={styles.discardCounterText}>{discardCountLabel}</Text>
                <Text style={styles.discardCounterHint}>
                  {picked.length <= discardMin
                    ? `Obligatorias ${discardMin} · puedes llegar a ${discardMax}`
                    : `Descartes ${picked.length} de ${discardMax}`}
                </Text>
              </View>
              <View style={styles.hand}>
                {hand.map((c, slotIdx) => (
                  <View
                    key={`discard-slot-${slotIdx}`}
                    style={[styles.handItem, handItemLayoutStyle]}
                  >
                    <CardFace
                      kind="answer"
                      text={c.text}
                      square
                      dense
                      gridColumns={handColumns}
                      forceFontSize={handFontSize}
                      selected={false}
                      discardMarked={picked.includes(c.id)}
                      flashGreen={flashGreenIds.includes(c.id)}
                      onPress={() => pickCard(c.id)}
                    />
                  </View>
                ))}
              </View>
              <Muted>
                Marcadas en rojo se descartan. Mínimo {discardMin}; al llegar a {discardMax} se envía solo.
              </Muted>
              <Button
                title={`Confirmar descarte (${discardCountLabel})`}
                variant="discard"
                disabled={
                  picked.length < discardMin || picked.length > discardMax
                }
                onPress={() => autoSend(picked)}
              />
              {!isSolo ? (
                <Button
                  title="Ocultar mano"
                  variant="ghost"
                  onPress={() => {
                    setPrivacy(true);
                  }}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}

      {phase === 'submitting' ? (
        <>
          {alreadyAnswered ? (
            <View style={styles.doneBox}>
              <View style={styles.soloRivalHead}>
                <Text style={styles.doneBadge}>✓ Respuesta enviada</Text>
                {mySubmitted ? (
                  <Text
                    style={styles.soloStar}
                    onPress={() =>
                      toggleFavFilled(
                        Engine.getFilledSubmission(game, mySubmitted),
                        mySubmitted.cards
                      )
                    }
                  >
                    {isFavFilled(Engine.getFilledSubmission(game, mySubmitted))
                      ? '★'
                      : '☆'}
                  </Text>
                ) : null}
              </View>
              {game.currentPrompt && submittedAnswerTexts.length ? (
                <FilledPromptText
                  promptText={game.currentPrompt.text}
                  answers={submittedAnswerTexts}
                />
              ) : null}
              {!isSolo ? (
              <WaitingRoster
                  players={game.players}
                  doneIds={roundSubs.filter((s) => !s.rival).map((s) => s.playerId)}
                  meId={myPlayerId ?? active?.id}
                                verb="responda"
                mineWaitLabel="esperando respuestas"
         />
              ) : null}
            </View>
          ) : privacy && !isSolo && !isOnline ? (
            <>
              <Subtitle>¿Eres {active?.nickname}?</Subtitle>
              <Muted>Ocultamos la mano hasta que confirmes (pass-and-play).</Muted>
              <Button title="Sí, mostrar mi mano" onPress={() => setPrivacy(false)} />
            </>
          ) : zarSkipsSubmit &&
            (isOnline ? myPlayerId === zar.id : active?.id === zar.id) ? (
              <WaitingRoster
              players={game.players}
              doneIds={roundSubs.filter((s) => !s.rival).map((s) => s.playerId)}
              meId={myPlayerId ?? active?.id}
              verb="responda"
         />
          ) : (
            <>
              {!isSolo ? (
                <Label>{isOnline ? 'Tu mano' : `Mano de ${active?.nickname}`}</Label>
              ) : null}
              {soloSkipMode ? (
                <View style={styles.discardCounterBox}>
                  <Text style={styles.discardCounterText}>
                    {soloSkipCountLabel}
                  </Text>
                  <Text style={styles.discardCounterHint}>
                    {picked.length < pickNeed
                      ? `Toca ${pickNeed} cartas · se ponen rojas`
                      : '2/2 — enviando descarte…'}
                  </Text>
                </View>
              ) : null}
              <View style={styles.hand}>
                {hand.map((c, slotIdx) => (
                  <View
                    key={`hand-slot-${slotIdx}`}
                    style={[styles.handItem, handItemLayoutStyle]}
                  >
                    <CardFace
                      kind="answer"
                      text={c.text}
                      square
                      dense
                      gridColumns={handColumns}
                      forceFontSize={handFontSize}
                      selected={
                        soloSkipMode ? false : picked.includes(c.id)
                      }
                      discardMarked={
                        soloSkipMode ? picked.includes(c.id) : false
                      }
                      justReplaced={replacedSlots.includes(slotIdx)}
                      flashGreen={flashGreenIds.includes(c.id)}
                      selectionIndex={
                        soloSkipMode
                          ? undefined
                          : selectionIndexFor(c.id)
                      }
                      onPress={() => pickCard(c.id)}
                    />
                  </View>
                ))}
              </View>
              {isSolo &&
              !soloSkipMode &&
              !shouldDiscardBeforeRound(game.round, game.mode) ? (
                <Button
                  title="Descartar (tirar 2 y saltar ronda)"
                  variant="discard"
                  onPress={() => {
                    setPicked([]);
                    setSoloSkipMode(true);
                  }}
                />
              ) : null}
              {isSolo && soloSkipMode && !shouldDiscardBeforeRound(game.round, game.mode) ? (
                <Button
                  title={`Cancelar descarte (${soloSkipCountLabel})`}
                  variant="ghost"
                  onPress={() => {
                    setPicked([]);
                    setSoloSkipMode(false);
                  }}
                />
              ) : null}
              {!isSolo && !isOnline ? (
                <Button
                  title="Ocultar mano"
                  variant="ghost"
                  onPress={() => {
                    setPrivacy(true);
                    setPicked([]);
                  }}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}

      {phase === 'judging' ? (
        <>
          {voteMode && !isSolo ? (
            <>
              <Muted>
                Votos {Object.keys(votesMap).length}/
                {game.submissions.filter((s) => !s.rival).length}
                {votersPending.length
                  ? ` · faltan: ${votersPending
                      .map(
                        (id) =>
                          game.players.find((p) => p.id === id)?.nickname ?? '?'
                      )
                      .join(', ')}`
                  : ''}
             </Muted>
              <WaitingRoster
                players={game.players}
                doneIds={Object.keys(votesMap)}
                meId={myPlayerId ?? active?.id}
                verb="vote"
              />
              {active && votesMap[active.id] ? (
                <Muted>
                  {isOnline
                    ? 'Ya has votado. Esperando votos…'
                    : `${active.nickname} ya votó. Pasa el móvil al siguiente.`}
                </Muted>
              ) : privacy && !isOnline ? (
                <>
                  <Subtitle>¿Eres {active?.nickname}?</Subtitle>
                  <Muted>Vota tu favorita (no puedes elegir la tuya).</Muted>
                  <Button
                    title="Sí, mostrar jugadas"
                    onPress={() => setPrivacy(false)}
                  />
                </>
              ) : (
                <>
                  <Label>
                    {isOnline
                      ? 'Elige una de las dos (puedes votar la tuya)'
                      : `Voto de ${active?.nickname} — elige una (anónimas)`}
                  </Label>
                  {revealOrderSafe
                    .map((idx) => game.submissions[idx])
                    .filter(
                      (sub): sub is NonNullable<typeof sub> =>
                        !!sub &&
                        !sub.rival &&
                        (showOwnAnswerWhenVoting(game) || !(active && sub.playerId === active.id))
                    )
                    .map((sub, optNum) => {
                      const filled = Engine.getFilledSubmission(game, sub);
                      return (
                      <View key={sub.playerId} style={styles.judgeCard}>
                        <View style={styles.soloRivalHead}>
                          <Text style={styles.judgeLabel}>
                            Opción {optNum + 1}
                          </Text>
                          <Text
                            style={styles.soloStar}
                            onPress={() => toggleFavFilled(filled, sub.cards)}
                          >
                            {isFavFilled(filled) ? '★' : '☆'}
                          </Text>
                        </View>
                        <FilledPromptText
                          large
                          promptText={game.currentPrompt?.text ?? ''}
                          answers={sub.cards.map((c) => c.text)}
                        />
                        <Button
                          title="Votar esta"
                          onPress={() => castVote(sub.playerId)}
                        />
                      </View>
                    );
                    })}
                  {!isOnline ? (
                    <Button
                      title="Ocultar"
                      variant="ghost"
                      onPress={() => setPrivacy(true)}
                    />
                  ) : null}
                </>
              )}
            </>
          ) : privacy &&
            !isSolo &&
            !isOnline &&
            active?.id === zar.id ? (
            <Button
              title="Soy el Zar — revelar jugadas"
              onPress={() => setPrivacy(false)}
            />
          ) : (
            <>
              {(() => {
                const isZarSeat = isOnline
                  ? myPlayerId === zar.id
                  : active?.id === zar.id;
                const canPickWinner = isSolo || isZarSeat;
                return (
                  <>
                    <Label>
                      {isSolo
                        ? '¿Cuál gana? (tú o un rival)'
                        : canPickWinner
                          ? 'Elige la mejor jugada'
                          : 'Jugadas anónimas'}
                    </Label>
                    {revealOrderSafe.map((idx, optNum) => {
                      const sub = game.submissions[idx];
                      if (!sub) return null;
                      const isRival =
                        !!sub.rival || sub.playerId.startsWith('rival-');
                      // Solo may label Tú / bots; async/live stay anonymous until reveal
                      const label = isSolo
                        ? !!human && sub.playerId === human.id && !sub.rival
                          ? 'Tú'
                          : isRival
                            ? rivalLabel(sub.playerId)
                            : 'Opción'
                        : `Opción ${optNum + 1}`;
                      const filled = Engine.getFilledSubmission(game, sub);
                      return (
                        <View
                          key={`${sub.playerId}-${idx}`}
                          style={styles.judgeCard}
                        >
                          <View style={styles.soloRivalHead}>
                            <Text style={styles.judgeLabel}>{label}</Text>
                            <Text
                              style={styles.soloStar}
                              onPress={() => toggleFavFilled(filled, sub.cards)}
                            >
                              {isFavFilled(filled) ? '★' : '☆'}
                            </Text>
                          </View>
                          <FilledPromptText
                            large
                            promptText={game.currentPrompt?.text ?? ''}
                            answers={sub.cards.map((c) => c.text)}
                          />
                          {canPickWinner ? (
                            <Button
                              title="Gana esta"
                              onPress={() => judge(sub.playerId)}
                            />
                          ) : null}
                        </View>
                      );
                    })}
                    {!isSolo && !canPickWinner ? (
                      <Muted>El Zar está eligiendo…</Muted>
                    ) : null}
                  </>
                );
              })()}
            </>
          )}
        </>
      ) : null}

      {phase === 'reveal' ? (
        <>
          {isSolo ? (
            <>
              {/* Rivales primero; tu respuesta al final del scroll para ★ */}
              {game.submissions
                .filter((s) => s.rival || s.playerId.startsWith('rival-'))
                .map((sub) => {
                  const filled = Engine.getFilledSubmission(game, sub);
                  return (
                    <View key={sub.playerId} style={styles.soloRival}>
                      <View style={styles.soloRivalHead}>
                        <Text style={styles.judgeLabel}>
                          {rivalLabel(sub.playerId)}
                        </Text>
                        <Text
                          style={styles.soloStar}
                          onPress={() => toggleFavFilled(filled, sub.cards)}
                        >
                          {isFavFilled(filled) ? '★' : '☆'}
                        </Text>
                      </View>
                      <FilledPromptText
                        small
                        promptText={game.currentPrompt?.text ?? ''}
                        answers={sub.cards.map((c) => c.text)}
                      />
                    </View>
                  );
                })}
              <Button
                title="Favoritas"
                variant="ghost"
                onPress={() => router.push('/historial')}
              />
              {game.submissions
                .filter((s) => !s.rival && human && s.playerId === human.id)
                .map((sub) => {
                  const filled = Engine.getFilledSubmission(game, sub);
                  const fav =
                    isFavFilled(filled) ||
                    !!historyEntry?.favorite ||
                    favJustSaved;
                  return (
                    <View key={`last-${sub.playerId}`} style={styles.roundLastAnswer}>
                      <Text style={styles.roundLastTitle}>Tu última respuesta</Text>
                      <FilledPromptText
                        promptText={game.currentPrompt?.text ?? ''}
                        answers={sub.cards.map((c) => c.text)}
                      />
                      <Button
                        title={
                          fav
                            ? '★ Respuesta guardada'
                            : '☆ Añadir a favoritas'
                        }
                        variant={fav ? 'ghost' : 'outline'}
                        onPress={toggleMyAnswerFav}
                      />
                    </View>
                  );
                })}
            </>
          ) : (
            <>
              {(() => {
                const tieIds = (game.roundWinnerIds ?? []).filter(Boolean);
                const isTie = tieIds.length > 1;
                const iWon =
                  !!game.roundWinnerId &&
                  (isOnline
                    ? isTie
                      ? tieIds.includes(myPlayerId ?? '')
                      : myPlayerId === game.roundWinnerId
                    : isTie
                      ? !!active && tieIds.includes(active.id)
                      : active?.id === game.roundWinnerId || isSolo);
                const iAmNextZar =
                  !voteMode &&
                  !winnerIsRival &&
                  !!game.roundWinnerId &&
                  (isOnline
                    ? myPlayerId === game.roundWinnerId
                    : true);
                const tiedSubs = isTie
                  ? tieIds
                      .map((id) =>
                        game.submissions.find((s) => s.playerId === id)
                      )
                      .filter(
                        (s): s is NonNullable<typeof s> => !!s
                      )
                  : [];
                return (
                  <>
                    <View style={styles.revealTitleRow}>
                      <Title>
                        {isTie ? (game.roundWinnerId ? 'Empate' : 'Empate: voto dividido') : iWon ? '¡Puntaco!' : 'Fin de ronda'}
                      </Title>
                      {iWon && !isTie ? (
                        <Pressable
                          onPress={toggleMyAnswerFav}
                          hitSlop={12}
                          accessibilityLabel={
                            starFilled ? 'Respuesta guardada' : 'Marcar favorita'
                          }
                        >
                          <Text style={styles.revealFavStar}>
                            {starFilled ? '★' : '☆'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Subtitle>
                      {isTie
                        ? (game.roundWinnerId ? 'Empate · +1 cada una' : 'Empate: voto dividido · sin puntos')
                        : winnerIsRival
                          ? `Gana el bot (${winnerName})`
                          : iWon
                            ? `Has ganado esta ronda`
                            : `Gana: ${winnerName}`}
                      {!isTie && !isSolo && !winnerIsRival && !voteMode
                        ? ` · próximo Zar: ${winnerName}`
                        : ''}
                    </Subtitle>
                                        <Muted>
                      {iWon
                        ? 'Tu respuesta ha ganado'
                        : `Ganó ${winnerName}`}
                    </Muted>
                    {isTie
                      ? tiedSubs.map((sub) => {
                          const filled = Engine.getFilledSubmission(game, sub);
                          const nick =
                            game.players.find((p) => p.id === sub.playerId)
                              ?.nickname ?? '—';
                          return (
                            <View
                              key={`tie-${sub.playerId}`}
                              style={styles.judgeCard}
                            >
                              <View style={styles.soloRivalHead}>
                                <Text style={styles.judgeLabel}>
                                  {`${nick} · ${(game.players.find((p) => p.id === sub.playerId)?.score ?? 0)} Puntacos · ronda ${game.round}`}
                                </Text>
                                <Text
                                  style={styles.soloStar}
                                  onPress={() =>
                                    toggleFavFilled(filled, sub.cards)
                                  }
                                >
                                  {isFavFilled(filled) ? '★' : '☆'}
                                </Text>
                              </View>
                              <FilledPromptText
                                large
                                promptText={game.currentPrompt?.text ?? ''}
                                answers={sub.cards.map((c) => c.text)}
                              />
                            </View>
                          );
                        })
                      : winnerSub
                        ? (() => {
                            const filled = Engine.getFilledSubmission(
                              game,
                              winnerSub
                            );
                            return (
                              <View style={styles.judgeCard}>
                                <View style={styles.soloRivalHead}>
                                  <Text style={styles.judgeLabel}>
                                    {`${winnerName} · ${
                                      winnerIsRival
                                        ? 0
                                        : game.players.find((p) => p.id === game.roundWinnerId)?.score ?? 0
                                    } Puntacos · ronda ${game.round}`}
                                  </Text>
                                  <Text
                                    style={styles.soloStar}
                                    onPress={() =>
                                      toggleFavFilled(filled, winnerSub.cards)
                                    }
                                  >
                                    {isFavFilled(filled) ? '★' : '☆'}
                                  </Text>
                                </View>
                                <FilledPromptText
                                  large
                                  promptText={game.currentPrompt?.text ?? ''}
                                  answers={winnerSub.cards.map((c) => c.text)}
                                />
                              </View>
                            );
                          })()
                        : null}
                                       <RoundStandings game={game} meId={myPlayerId ?? active?.id} />
                    {!isSolo ? (
                      <Muted>
                        {iAmNextZar
                          ? 'Eres el próximo Zar: empieza ya o en 10 s pasa sola.'
                          : `Esperando a que ${winnerName} (Zar) empiece la siguiente ronda…`}
                      </Muted>
                    ) : null}
                                       {isSolo || iAmNextZar || !isOnline ? (
                      <AdvanceRoundButton
                        isSolo={!!isSolo}
                        isZar={!!iAmNextZar}
                        onPress={() => continueRound()}
                      />
                    ) : null}
                    {iWon ? revealShareSaveRow : null}
                    <Button
                      title="Respuestas favoritas"
                      variant="ghost"
                      onPress={() => router.push('/historial')}
                    />
                  </>
                );
              })()}
            </>
          )}
        </>
      ) : null}

      {isOnline && iAmHostPlayer ? (
        <HostRecoveryLinks
          code={game.code}
          players={game.players}
          compact
        />
      ) : null}
      </ScrollView>


    </View>
  );
}

function usePlayStyles() {
  const { colors, fontFamily } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  discardCounterBox: {
    backgroundColor: '#5A1820',
    borderWidth: 2,
    borderColor: '#E53935',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 2,
    marginBottom: 4,
  },
  discardCounterText: {
    color: '#FFCDD2',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  discardCounterHint: {
    color: '#E57373',
    fontSize: 12,
    fontWeight: '600',
  },
  adminBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
  },
  adminChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adminChipText: {
    color: colors.accentSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  sticky: {

    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
    gap: 4,
    zIndex: 20,
  },
  roundSticky: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roundStickyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    flexShrink: 1,
  },
  roundStickyScore: {
    color: colors.accentSoft,
    fontSize: 13,
    fontWeight: '900',
  },
  scrollInnerTight: {
    paddingTop: 8,
    gap: 8,
  },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 48, gap: 12 },
  liveBox: {
    backgroundColor: colors.promptBg,
    borderRadius: 4,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  liveBoxWithFavSlot: {
    position: 'relative',
    // Keep right gutter reserved so ★ never pushes the prompt sideways
    paddingRight: 44,
  },
  liveLabel: {
    color: colors.accentSoft,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  doneBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 8,
  },
  doneBadge: {
    color: colors.accentSoft,
    fontWeight: '900',
    fontSize: 15,
  },
  scores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreItem: {
    color: colors.textMuted,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
    overflow: 'hidden',
    fontWeight: '600',
  },
  seatRow: { gap: 8 },
  hand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
    width: '100%',
  },
  handItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
  revealFavStarAbs: {
    position: 'absolute',
    top: 4,
    right: 6,
    zIndex: 5,
  },
  revealFavStar: {
    color: colors.zar,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
    paddingHorizontal: 4,
  },
  revealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  revealActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
  },
  shareSquare: {
    width: 52,
    height: 52,
    borderRadius: 4,
    borderWidth: 0,
    backgroundColor: '#2AABEE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: 2,
  },
  shareEnviar: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 10,
    textTransform: 'lowercase',
  },
  sharePlane: {
    fontSize: 24,
    color: colors.accentSoft,
    lineHeight: 28,
  },
  guardarFlex: {
    flex: 1,
    justifyContent: 'center',
  },
  soloCompactBlock: {
    gap: 8,
  },
  soloCompactBlockHidden: {
    opacity: 0,
  },
  soloMine: {
    backgroundColor: colors.promptBg,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  soloMineBadge: {
    color: colors.accentSoft,
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  soloMineAnswers: {
    color: '#FF8A3D',
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  soloSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roundLastAnswer: {
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: 8,
  },
  roundLastTitle: {
    color: colors.accentSoft,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  soloRival: {
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  soloMineRow: {
    borderColor: colors.accent,
    backgroundColor: colors.promptBg,
  },
  soloRivalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  soloStar: {
    color: colors.zar,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 4,
  },
  soloRivalText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  judgeCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  judgeLabel: {
    color: colors.accentSoft,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
}),
    [colors, fontFamily]
  );
}
