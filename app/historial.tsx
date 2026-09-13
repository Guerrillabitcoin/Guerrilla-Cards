import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Button,
  Chip,
  FilledPromptText,
  Loading,
  Muted,
  Screen,
  Subtitle,
  Title,
} from '@/src/components/ui';
import { EnviarShareButton } from '@/src/components/EnviarShareButton';
import { useHistoryStore } from '@/src/store/HistoryContext';
import { useTheme } from '@/src/store/ThemeContext';

type Tab = 'favoritos' | 'recientes' | 'descartes' | 'stats';
type StatsSort = 'problem' | 'discard' | 'stale' | 'wins';

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default function HistorialScreen() {
  const styles = useHistorialStyles();

  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const compact = winW < 700;
  const {
    ready,
    winningHistory,
    favorites,
    favoriteAnswers,
    toggleFavorite,
    deleteHistoryItem,
    deleteFavoriteAnswer,
    topDiscarded,
    listCardStats,
  } = useHistoryStore();
  const [tab, setTab] = useState<Tab>('favoritos');
  const [statsSort, setStatsSort] = useState<StatsSort>('problem');

  const discarded = useMemo(() => topDiscarded(30), [topDiscarded]);
  const cardStatViews = useMemo(
    () => listCardStats({ minDrawn: 2, sort: statsSort }),
    [listCardStats, statsSort]
  );

  if (!ready) return <Loading />;

  const confirmDelete = (id: string, label: string, kind: 'history' | 'answer') => {
    Alert.alert('Borrar', `¿Eliminar?

${label.slice(0, 100)}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          kind === 'history' ? deleteHistoryItem(id) : deleteFavoriteAnswer(id),
      },
    ]);
  };


  // One card per filled text — history ★ wins over answer-only copies
  const favoritosUniq = useMemo(() => {
    const seen = new Set<string>();
    const out: {
      key: string;
      promptText: string;
      answers: string[];
      filledText: string;
      historyId?: string;
      answerId?: string;
    }[] = [];
    for (const item of favorites) {
      const k = (item.filledText || '').trim().toLocaleLowerCase('es-ES');
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({
        key: `h-${item.id}`,
        promptText: item.promptText,
        answers: item.answers,
        filledText: item.filledText,
        historyId: item.id,
      });
    }
    for (const a of favoriteAnswers) {
      const k = a.text.trim().toLocaleLowerCase('es-ES');
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const matched =
        winningHistory.find(
          (h) => h.filledText.trim().toLocaleLowerCase('es-ES') === k
        ) ?? null;
      const promptText =
        (a.promptText && a.promptText !== '______'
          ? a.promptText
          : matched?.promptText) || '';
      const answers =
        a.answers?.length
          ? a.answers
          : matched?.answers?.length
            ? matched.answers
            : [];
      out.push({
        key: `a-${a.id}`,
        promptText,
        answers,
        filledText: matched?.filledText ?? a.text,
        answerId: a.id,
        historyId: matched?.id,
      });
    }
    return out;
  }, [favorites, favoriteAnswers, winningHistory]);

  return (
    <Screen contentDense={!compact}>
      <Title style={compact ? styles.titleCompact : undefined}>Respuestas favoritas</Title>
      <Subtitle style={compact ? styles.subCompact : undefined}>
        Tus ★ y las últimas respuestas para no perder ninguna.
      </Subtitle>

      <View style={styles.tabs}>
        <Chip
          label={`★ Favoritas (${favoritosUniq.length})`}
          selected={tab === 'favoritos'}
          onPress={() => setTab('favoritos')}
        />
        <Chip
          label={`Recientes (${winningHistory.length})`}
          selected={tab === 'recientes'}
          onPress={() => setTab('recientes')}
        />
        <Chip
          label={`Descartes (${discarded.length})`}
          selected={tab === 'descartes'}
          onPress={() => setTab('descartes')}
        />
        <Chip
          label={`Stats (${cardStatViews.length})`}
          selected={tab === 'stats'}
          onPress={() => setTab('stats')}
        />
      </View>

      {tab === 'favoritos' ? (
        favoritosUniq.length === 0 ? (
          <Muted>Sin favoritas. Marca ★ en una reciente o durante la partida.</Muted>
        ) : (
          favoritosUniq.map((item) => (
            <View key={item.key} style={[styles.card, styles.cardFav]}>
              <View style={styles.favStarRow}>
                <Pressable
                  onPress={() => {
                    if (item.historyId) toggleFavorite(item.historyId);
                    if (item.answerId) deleteFavoriteAnswer(item.answerId);
                  }}
                  hitSlop={8}
                  style={styles.starHit}
                >
                  <Text style={styles.starFav}>★</Text>
                </Pressable>
              </View>
              {item.promptText && /_/.test(item.promptText) && item.answers.length ? (
                <FilledPromptText
                  small
                  promptText={item.promptText}
                  answers={item.answers}
                />
              ) : item.promptText && item.answers.length ? (
                <View style={styles.favSplit}>
                  <Text style={styles.favPromptOnly}>{item.promptText}</Text>
                  <Text style={styles.favAnswersOnly}>
                    {item.answers.join(' · ')}
                  </Text>
                </View>
              ) : (
                <View style={styles.favSplit}>
                  <Text style={styles.favLegacyHint}>
                    Formato antiguo — vuelve a marcar ★ en partida para separar
                    pregunta (blanco) y respuesta (naranja).
                  </Text>
                  <Text style={styles.favPromptOnly}>{item.filledText}</Text>
                </View>
              )}
              <View style={styles.cardFooterRight}>
                <EnviarShareButton
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: '/compartir',
                      params: {
                        promptText: item.promptText || '',
                        answers: JSON.stringify(item.answers),
                        filledText: item.filledText,
                      },
                    })
                  }
                />
              </View>
            </View>
          ))
        )
      ) : null}

      {tab === 'recientes' ? (
        winningHistory.length === 0 ? (
          <Muted>Aún no hay respuestas recientes. Juega y aparecerán aquí.</Muted>
        ) : (
          winningHistory.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.gameCode ? `${item.gameCode}` : 'partida'}
                  {item.round != null ? ` · r${item.round}` : ''}
                  {' · '}
                  {new Date(item.createdAt).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Pressable onPress={() => toggleFavorite(item.id)} hitSlop={8}>
                  <Text style={styles.star}>{item.favorite ? '★' : '☆'}</Text>
                </Pressable>
              </View>
              <FilledPromptText
                small
                promptText={item.promptText}
                answers={item.answers}
              />
              <View style={styles.cardFooterRight}>
                <Pressable
                  onPress={() => confirmDelete(item.id, item.filledText, 'history')}
                  hitSlop={8}
                  style={styles.footerDelete}
                >
                  <Text style={styles.deleteLink}>Borrar</Text>
                </Pressable>
                <EnviarShareButton size="sm"
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
          ))
        )
      ) : null}

      {tab === 'descartes' ? (
        discarded.length === 0 ? (
          <Muted>
            Aún no hay descartes. Usa “Descartar” en solo o la ronda de descarte en
            multijugador.
          </Muted>
        ) : (
          discarded.map((item, idx) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.rank}>
                #{idx + 1} · ×{item.count}
              </Text>
              <Text style={styles.answerOnly}>{item.text}</Text>
            </View>
          ))
        )
      ) : null}

      {tab === 'stats' ? (
        <>
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Más problemáticas</Text>
            <View style={styles.sortChips}>
              {(
                [
                  ['problem', 'Problema'],
                  ['discard', 'Descartes'],
                  ['stale', 'Stale'],
                  ['wins', 'Wins'],
                ] as const
              ).map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  selected={statsSort === key}
                  onPress={() => setStatsSort(key)}
                />
              ))}
            </View>
          </View>
          {cardStatViews.length === 0 ? (
            <Muted>Sin datos aún — juega unas rondas</Muted>
          ) : (
            cardStatViews.map((s) => (
              <View key={s.cardId} style={styles.statCard}>
                <Text style={styles.statText} numberOfLines={2}>
                  {s.text}
                </Text>
                <Text style={styles.statMeta}>
                  drawn {s.timesDrawn}
                  {'  ·  '}
                  play {pct(s.playRate)}
                  {'  ·  '}
                  discard {pct(s.discardRate)}
                  {'  ·  '}
                  stale {pct(s.staleRate)}
                  {'  ·  '}
                  win {pct(s.winRate)}
                  {(s.timesUnmarkedForcedDiscard ?? 0) > 0
                    ? `  ·  desmarcó forzada ×${s.timesUnmarkedForcedDiscard}`
                    : ''}
                </Text>
              </View>
            ))
          )}
        </>
      ) : null}

      <Button title="Volver" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}

function useHistorialStyles() {
  const { colors, fontFamily } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
  cardFooterRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  footerDelete: {
    marginRight: 'auto' as const,
  },
  titleCompact: { fontSize: 22 },
  subCompact: { fontSize: 13, lineHeight: 18 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFav: {
    borderColor: colors.accent,
  },
  favSplit: { gap: 6 },
  favPromptOnly: {
    color: colors.promptText,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },
  favAnswersOnly: {
    color: '#FF8A3D',
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  favLegacyHint: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    color: colors.accentSoft,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  star: {
    color: colors.zar,
    fontSize: 18,
    fontWeight: '900',
  },
  favStarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 2,
  },
  favActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    minHeight: 32,
  },
  starHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starFav: {
    color: colors.zar,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
  },
  answerOnly: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 19,
  },
  rank: {
    color: colors.accentSoft,
    fontWeight: '800',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteLink: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  sortRow: { gap: 6 },
  sortLabel: {
    color: colors.accentSoft,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sortChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 19,
  },
  statMeta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
}),
    [colors, fontFamily]
  );
}

