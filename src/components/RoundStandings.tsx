import { StyleSheet, Text, View } from 'react-native';
import type { GameState, Player } from '../engine/types';
import { isTwoPlayerVote, votesFor } from '../engine/vote2p';

function deltaFor(game: GameState, p: Player): number {
  if (isTwoPlayerVote(game)) return votesFor(game, p.id);
  const ties = game.roundWinnerIds ?? [];
  if (ties.length > 1) return ties.includes(p.id) ? 1 : 0;
  return p.id === game.roundWinnerId ? 1 : 0;
}

export function RoundStandings({
  game,
  meId,
}: {
  game: GameState;
  meId?: string | null;
}) {
  const rows = [...game.players]
    .filter((p) => !p.isBot)
    .map((p) => {
      const d = deltaFor(game, p);
      return { p, d, prev: p.score - d };
    });
  const now = [...rows].sort((a, b) => b.p.score - a.p.score || a.p.nickname.localeCompare(b.p.nickname));
  const was = [...rows].sort((a, b) => b.prev - a.prev || a.p.nickname.localeCompare(b.p.nickname));
  const wasRank = new Map(was.map((r, i) => [r.p.id, i]));

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Clasificación</Text>
      {now.map((r, i) => {
        const old = wasRank.get(r.p.id) ?? i;
        const climb = old - i;
        const arrow = climb > 0 ? '↑' : climb < 0 ? '↓' : '=';
        return (
          <View key={r.p.id} style={[styles.row, i === 0 && styles.lead]}>
            <Text style={styles.pos}>{i + 1}</Text>
            <Text style={[styles.arrow, climb > 0 ? styles.up : climb < 0 ? styles.down : styles.same]}>
              {arrow}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {r.p.nickname}
              {meId === r.p.id ? ' · tú' : ''}
            </Text>
            <Text style={[styles.delta, r.d > 0 ? styles.plus : styles.zero]}>
              {r.d > 0 ? `+${r.d}` : '+0'}
            </Text>
            <Text style={styles.total}>{r.p.score}</Text>
          </View>
        );
      })}
      <Text style={styles.hint}>
        Meta {game.targetScore} · +N esta ronda · número grande = total
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
  arrow: { width: 16, fontWeight: '900', fontSize: 16 },
  up: { color: '#66BB6A' },
  down: { color: '#EF5350' },
  same: { color: '#9E9E9E' },
  name: { flex: 1, color: '#FFF', fontWeight: '800', fontSize: 16 },
  delta: { fontWeight: '900', fontSize: 18, minWidth: 36, textAlign: 'right' },
  plus: { color: '#69F0AE' },
  zero: { color: '#757575' },
  total: { color: '#FFE082', fontWeight: '900', fontSize: 20, minWidth: 28, textAlign: 'right' },
  hint: { color: '#A1887F', fontSize: 11, marginTop: 4 },
});
