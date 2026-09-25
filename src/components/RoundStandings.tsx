import { StyleSheet, Text, View } from 'react-native';
import type { GameState, Player } from '../engine/types';
import { votesFor } from '../engine/vote2p';

function humanCount(game: GameState): number {
  return game.players.filter((p) => !p.isBot).length;
}

function isVoteSplit(game: GameState): boolean {
  if ((game.judgeMode ?? 'zar') !== 'vote' || game.mode === 'solo') return false;
  return (game.roundWinnerIds ?? []).length > 1;
}

function deltaFor(game: GameState, p: Player): number {
  if (isVoteSplit(game)) return 0;
  return p.id === game.roundWinnerId ? 1 : 0;
}

export function RoundStandings({
  game,
  meId,
}: {
  game: GameState;
  meId?: string | null;
}) {
  const split = isVoteSplit(game);
  const humans = humanCount(game);
  const tieIds = (game.roundWinnerIds ?? []).filter(Boolean);
  const rows = [...game.players]
    .filter((p) => !p.isBot)
    .map((p) => {
      const d = deltaFor(game, p);
      return { p, d, prev: p.score - d };
    });
  const now = [...rows].sort(
    (a, b) => b.p.score - a.p.score || a.p.nickname.localeCompare(b.p.nickname)
  );

  return (
    <View style={styles.box}>
      <Text style={styles.title}>
        {split ? 'Voto dividido · +0' : 'Clasificación'}
      </Text>
      {split && humans >= 4
        ? tieIds.map((id) => {
            const nick =
              game.players.find((x) => x.id === id)?.nickname ?? id;
            const n = votesFor(game, id);
            return (
              <Text key={id} style={styles.tieLine}>
                {nick}: {n} voto{n === 1 ? '' : 's'}
              </Text>
            );
          })
        : null}
      {now.map((r, i) => (
        <View key={r.p.id} style={[styles.row, i === 0 && styles.lead]}>
          <Text style={styles.pos}>{i + 1}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {r.p.nickname}
            {meId === r.p.id ? ' · tú' : ''}
          </Text>
          <Text style={[styles.delta, r.d > 0 ? styles.plus : styles.zero]}>
            {r.d > 0 ? `+${r.d}` : '+0'}
          </Text>
          <Text style={styles.total}>{r.p.score}</Text>
        </View>
      ))}
      <Text style={styles.hint}>
        {split
          ? humans >= 4
            ? 'Empate · nadie suma esta ronda'
            : 'Voto dividido · nadie suma esta ronda'
          : `Meta ${game.targetScore} · +N esta ronda · número grande = total`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderColor: '#F9A825',
    backgroundColor: '#1A1208',
    borderRadius: 4,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  title: {
    color: '#FFE082',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tieLine: { color: '#FFE082', fontWeight: '800', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#4E342E',
  },
  lead: { backgroundColor: '#2E1F00' },
  pos: { width: 18, color: '#FFF8E1', fontWeight: '900' },
  name: { flex: 1, color: '#FFF', fontWeight: '800', fontSize: 16 },
  delta: { fontWeight: '900', fontSize: 18, minWidth: 36, textAlign: 'right' },
  plus: { color: '#69F0AE' },
  zero: { color: '#757575' },
  total: {
    color: '#FFE082',
    fontWeight: '900',
    fontSize: 20,
    minWidth: 28,
    textAlign: 'right',
  },
  hint: { color: '#A1887F', fontSize: 11, marginTop: 4 },
});
