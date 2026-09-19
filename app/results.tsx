import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  FilledPromptText,
  Label,
  Loading,
  Muted,
  Screen,
  Title,
} from '@/src/components/ui';
import { EnviarShareButton } from '@/src/components/EnviarShareButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fillBlank } from '@/src/engine/deck';
import { WaitingRoster } from '@/src/components/WaitingRoster';
import * as Engine from '@/src/engine/game';
import { useGameStore } from '@/src/store/GameContext';
import { useHistoryStore } from '@/src/store/HistoryContext';
import {
  getMySeat,
  getMySeatSync,
  getOnlineFlag,
  pullRoom,
  pushRoom,
} from '@/src/store/roomSync';
import { useTheme } from '@/src/store/ThemeContext';


export default function ResultsScreen() {
  const styles = useResultsStyles();

  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { getGame, restartSameSetup, ready, applyRemoteGame, updateGame } = useGameStore();
  const [onlineRoom, setOnlineRoom] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const {
    recordLeftInHand,
    winningHistory,
    appendWinner,
    toggleFavorite,
  } = useHistoryStore();
  const staleOnceRef = useRef<string | null>(null);
  const rematchOnceRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const gameCode = code ? String(code).toUpperCase() : '';
  const game = ready && gameCode ? getGame(gameCode) : undefined;

  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    void (async () => {
      const [online, seat] = await Promise.all([
        getOnlineFlag(gameCode),
        getMySeat(gameCode),
      ]);
      if (cancelled) return;
      setOnlineRoom(online);
      setMyPlayerId(seat);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameCode]);

  // Poll remote room while on results (async online rematch)
  useEffect(() => {
    if (!ready || !gameCode || !onlineRoom) return;
    let cancelled = false;
    const tick = async () => {
      const res = await pullRoom(gameCode);
      if (cancelled || !res.ok) return;
      applyRemoteGame(res.state);
    };
    void tick();
    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, gameCode, onlineRoom, applyRemoteGame]);

  // Guest: when host (or anyone) restarts, leave results → play
  useEffect(() => {
    if (!ready || !game || !onlineRoom) return;
    if (game.phase !== 'results' && game.phase !== 'lobby') {
      router.replace({ pathname: '/play', params: { code: game.code } });
    }
  }, [ready, game?.phase, game?.code, onlineRoom, router]);

  useEffect(() => {
    if (!game || game.phase !== 'results') return;
    const key = `${game.code}:stale`;
    if (staleOnceRef.current === key) return;
    staleOnceRef.current = key;
    const left = game.players
      .filter((p) => !p.isBot)
      .flatMap((p) =>
        p.hand.map((c) => ({ id: c.id, text: c.text, kind: 'answer' as const }))
      );
    if (left.length) recordLeftInHand(left);
  }, [game, recordLeftInHand]);

  const lastAnswer = useMemo(() => {
    if (!game) return null;
    const human =
      game.players.find((p) => !p.isBot) ??
      game.players.find((p) => p.isHost) ??
      null;
    if (!human) return null;

    let humanSub =
      game.submissions.find((s) => s.playerId === human.id && !s.rival) ??
      null;
    if (
      !humanSub &&
      game.roundWinnerId === human.id &&
      !String(game.roundWinnerId).startsWith('rival-')
    ) {
      humanSub =
        game.submissions.find((s) => s.playerId === human.id) ?? null;
    }

    if (game.currentPrompt && humanSub) {
      const promptText = game.currentPrompt.text;
      const answers = humanSub.cards.map((c) => c.text);
      return {
        promptText,
        answers,
        filledText: fillBlank(promptText, answers),
        packs: game.packIds,
        round: game.round,
        gameCode: game.code,
      };
    }

    const fromHist = winningHistory.find((h) => h.gameCode === game.code);
    if (fromHist) {
      return {
        promptText: fromHist.promptText,
        answers: fromHist.answers,
        filledText: fromHist.filledText,
        packs: fromHist.packs ?? game.packIds,
        round: fromHist.round ?? game.round,
        gameCode: game.code,
        historyId: fromHist.id,
        favorite: !!fromHist.favorite,
      };
    }

    return null;
  }, [game, winningHistory]);

  const existingEntry = useMemo(() => {
    if (!lastAnswer) return null;
    if (lastAnswer.historyId) {
      return winningHistory.find((h) => h.id === lastAnswer.historyId) ?? null;
    }
    return (
      winningHistory.find(
        (h) =>
          h.gameCode === lastAnswer.gameCode &&
          h.filledText === lastAnswer.filledText
      ) ??
      winningHistory.find((h) => h.filledText === lastAnswer.filledText) ??
      null
    );
  }, [lastAnswer, winningHistory]);

  const inHistory = !!(savedId || existingEntry);
  const historyId = savedId ?? existingEntry?.id ?? null;
  const isFavorite = historyId
    ? !!winningHistory.find((h) => h.id === historyId)?.favorite
    : false;

  /** All your fills this match, oldest round first (scroll archive) */
  const roundAnswers = useMemo(() => {
    if (!game) return [];
    const items = winningHistory.filter((h) => h.gameCode === game.code);
    // Newest first (última → primera)
    return [...items].sort((a, b) => (b.round ?? 0) - (a.round ?? 0));
  }, [game, winningHistory]);

  // Auto-start rematch when all humans ready (peer may have been last)
  useEffect(() => {
    if (!ready || !game || game.phase !== 'results') return;
    if (game.mode === 'solo' || !onlineRoom) return;
    if (!Engine.allHumansRestartReady(game)) return;
    if ((game.restartReadyIds?.length ?? 0) === 0) return;
    const stamp = `${game.code}:${(game.restartReadyIds || []).slice().sort().join(',')}`;
    if (rematchOnceRef.current === stamp) return;
    rematchOnceRef.current = stamp;
    const next = restartSameSetup(game.code);
    if (!next) return;
    if (next.phase === 'lobby') {
      router.replace({ pathname: '/lobby', params: { code: next.code } });
    } else {
      router.replace({ pathname: '/play', params: { code: next.code } });
    }
  }, [
    ready,
    game?.code,
    game?.phase,
    game?.mode,
    game?.restartReadyIds,
    onlineRoom,
    restartSameSetup,
    router,
  ]);

  if (!ready) return <Loading />;

  if (!game) {
    return (
      <Screen>
        <Title>Sin resultados</Title>
        <Button title="Inicio" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const humans = game.players.filter((p) => !p.isBot);
  const board = humans.length ? humans : game.players;
  const ranked = [...board].sort((a, b) => b.score - a.score);
  const winner = ranked[0];

  const doRestartNow = () => {
    const next = restartSameSetup(game.code);
    if (!next) {
      router.replace('/');
      return;
    }
    if (next.phase === 'lobby') {
      router.replace({ pathname: '/lobby', params: { code: next.code } });
    } else {
      router.replace({ pathname: '/play', params: { code: next.code } });
    }
  };

  const onRestartReady = () => {
    // Solo: restart immediately (no liga wait)
    if (game.mode === 'solo' || !onlineRoom) {
      doRestartNow();
      return;
    }
    if (!myPlayerId) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Reiniciar: no se encontró tu asiento');
      }
      return;
    }
    updateGame(game.code, (g) => Engine.markRestartReady(g, myPlayerId));
    void (async () => {
      const g = getGame(game.code);
      if (!g) return;
      await pushRoom(g, myPlayerId);
      // If everyone ready after our tap, start
      if (Engine.allHumansRestartReady(g)) {
        doRestartNow();
      }
    })();
  };

  const onForceRestart = () => {
    if (!Engine.canForceRestart(game, myPlayerId)) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(
          'Solo el anfitrión o el ganador de la partida pueden forzar el reinicio.'
        );
      }
      return;
    }
    doRestartNow();
  };

  const onAddToHistory = async () => {
    if (!lastAnswer || saving) return;
    if (inHistory && historyId) {
      toggleFavorite(historyId);
      return;
    }
    setSaving(true);
    try {
      const entry = await appendWinner({
        promptText: lastAnswer.promptText,
        answers: lastAnswer.answers,
        filledText: lastAnswer.filledText,
        packs: lastAnswer.packs,
        gameCode: lastAnswer.gameCode,
        round: lastAnswer.round,
        favorite: true,
      });
      setSavedId(entry.id);
    } finally {
      setSaving(false);
    }
  };

  const isSolo = game.mode === 'solo';
  const answersTitle = isSolo
    ? 'Tus respuestas de la partida'
    : 'Tus respuestas';
  const answersHint = isSolo
    ? 'Las 10 rondas · de la última a la primera · toca ★ para favoritas'
    : 'De la última a la primera · toca ★ para favoritas';

  const rankingBlock =
    !isSolo && ranked.length >= 1 ? (
      <View style={styles.list}>
        <Label>Clasificación final</Label>
        {ranked.map((p, i) => (
          <View
            key={p.id}
            style={[styles.row, i === 0 && styles.rowFirst]}
          >
            <View style={[styles.rankBadge, i === 0 && styles.rankBadgeFirst]}>
              <Text style={styles.rank}>{i + 1}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {p.isBot ? '🤖 ' : ''}
              {p.nickname}
            </Text>
            <Text style={[styles.score, i === 0 && styles.scoreFirst]}>
              {p.score}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  const readyIds = game.restartReadyIds ?? [];
  const iAmReady = !!(myPlayerId && readyIds.includes(myPlayerId));
  const canForce = Engine.canForceRestart(game, myPlayerId);
  const leagueScores = game.leagueScores ?? {};
  const leagueRanked = [...board]
    .map((p) => ({
      ...p,
      liga: leagueScores[p.id] ?? 0,
    }))
    .sort((a, b) => b.liga - a.liga || b.score - a.score);

  const leagueBlock =
    !isSolo && board.length >= 1 ? (
      <View style={styles.list}>
        <Label>Liga (sesión)</Label>
        <Muted>+1 al ganador de cada partida · se guarda al reiniciar</Muted>
        {leagueRanked.map((p, i) => (
          <View
            key={`liga-${p.id}`}
            style={[styles.row, i === 0 && p.liga > 0 && styles.rowFirst]}
          >
            <View
              style={[styles.rankBadge, i === 0 && p.liga > 0 && styles.rankBadgeFirst]}
            >
              <Text style={styles.rank}>{i + 1}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {p.isBot ? '🤖 ' : ''}
              {p.nickname}
            </Text>
            <Text style={[styles.score, i === 0 && p.liga > 0 && styles.scoreFirst]}>
              {p.liga}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  const menuBlock = (
    <View style={styles.menuBlock}>
      {isSolo || !onlineRoom ? (
        <Button title="Reiniciar partida" onPress={onRestartReady} />
      ) : (
        <>
          <Button
            title={
              iAmReady
                ? 'Listo ✓ — esperando al resto'
                : 'Reiniciar partida (listo)'
            }
            onPress={onRestartReady}
            disabled={iAmReady}
          />
          <WaitingRoster
            players={board}
            doneIds={readyIds}
            meId={myPlayerId}
            verb="confirme"
          />
          {canForce ? (
            <Button
              title="Forzar reinicio (anfitrión/ganador)"
              variant="outline"
              onPress={onForceRestart}
            />
          ) : (
            <Muted>
              Todos deben confirmar, o el anfitrión/ganador puede forzar.
            </Muted>
          )}
        </>
      )}
      {leagueBlock}
      <Button
        title="★ Ver respuestas favoritas"
        variant="outline"
        onPress={() => router.push('/historial')}
      />
      <Button
        title="Menu inicio"
        variant="ghost"
        onPress={() => router.replace('/')}
      />
    </View>
  );

  return (
    <Screen>
      <View style={styles.heroCompact}>
        <Text style={styles.brand}>FIN DE PARTIDA</Text>
        <View style={styles.heroRow}>
          <Text style={styles.trophySmall}>★</Text>
          <View style={styles.heroTextCol}>
            <Text style={styles.winnerNameCompact} numberOfLines={1}>
              {winner?.nickname ?? '¿?'}
            </Text>
            <Text style={styles.metaLine}>
              {winner?.score ?? 0} Puntacos · {game.code} · {game.round}r
              {isSolo ? ' · Solo' : ''}
            </Text>
          </View>
        </View>
      </View>

      {!isSolo ? rankingBlock : null}
      {menuBlock}

      {/* Menú arriba; archivo de respuestas debajo. */}
      <View style={styles.answersBox}>
        <Text style={styles.lastTitle}>{answersTitle}</Text>
        <Muted>{answersHint}</Muted>
        {(() => {
          // Build list: history (newest first) + live lastAnswer if missing
          const list = [...roundAnswers];
          if (lastAnswer) {
            const already = list.some(
              (h) =>
                h.filledText === lastAnswer.filledText &&
                (h.round == null || h.round === lastAnswer.round)
            );
            if (!already) {
              list.unshift({
                id: historyId ?? 'live-last',
                promptText: lastAnswer.promptText,
                answers: lastAnswer.answers,
                filledText: lastAnswer.filledText,
                packs: lastAnswer.packs,
                createdAt: Date.now(),
                favorite: isFavorite,
                gameCode: lastAnswer.gameCode,
                round: lastAnswer.round,
              });
            }
          }
          if (list.length === 0) {
            return <Muted>Sin respuestas guardadas de esta partida.</Muted>;
          }
          return list.map((item, idx) => {
            const isFirst = idx === 0;
            return (
              <View
                key={item.id}
                style={[styles.roundCard, isFirst && styles.roundCardLast]}
              >
                <View style={styles.roundHead}>
                  <Text style={styles.roundMeta}>
                    Ronda {item.round ?? '—'}
                    {isFirst ? ' · última' : ''}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (item.id === 'live-last' || item.id === historyId) {
                        void onAddToHistory();
                      } else {
                        toggleFavorite(item.id);
                      }
                    }}
                    hitSlop={10}
                  >
                    <Text style={styles.star}>
                      {item.id === 'live-last' || item.id === historyId
                        ? isFavorite || item.favorite
                          ? '★'
                          : '☆'
                        : item.favorite
                          ? '★'
                          : '☆'}
                    </Text>
                  </Pressable>
                </View>
                <FilledPromptText
                  small={!isFirst}
                  promptText={item.promptText}
                  answers={item.answers}
                />
                <View style={styles.cardFooterRight}>
                  <EnviarShareButton
                    onPress={() =>
                      router.push({
                        pathname: '/compartir',
                        params: {
                          promptText: item.promptText,
                          answers: JSON.stringify(item.answers),
                          filledText: item.filledText,
                        },
                      })
                    }
                  />
                </View>
              </View>
            );
          });
        })()}
      </View>

    </Screen>
  );
}

function useResultsStyles() {
  const { colors, fontFamily } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
  heroCompact: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 4,
  },
  brand: {
    color: colors.accent,
    fontWeight: '900',
    letterSpacing: 3,
    fontSize: 11,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trophySmall: {
    color: colors.zar,
    fontSize: 28,
    fontWeight: '900',
  },
  heroTextCol: { flex: 1, gap: 2 },
  winnerNameCompact: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  metaLine: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
  menuBlock: {
    gap: 8,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { gap: 8, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  rowFirst: {
    borderColor: colors.zar,
    backgroundColor: colors.bgCard,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeFirst: {
    backgroundColor: colors.zar,
  },
  rank: { color: colors.text, fontWeight: '900', fontSize: 14 },
  name: { color: colors.text, fontWeight: '700', flex: 1, fontSize: 16 },
  score: { color: colors.textMuted, fontWeight: '800', fontSize: 18 },
  scoreFirst: { color: colors.zar },
  answersBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: 4,
    marginBottom: 24,
  },
  lastTitle: {
    color: colors.accentSoft,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  roundCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roundCardLast: {
    borderColor: colors.accent,
  },
  roundHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundMeta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
  },
  cardFooterRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  star: {
    color: colors.zar,
    fontSize: 20,
    fontWeight: '900',
  },
}),
    [colors, fontFamily]
  );
}

