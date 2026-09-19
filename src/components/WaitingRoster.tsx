import { StyleSheet, Text, View } from 'react-native';

export function WaitingRoster({
  players,
  doneIds,
  meId,
  verb = 'responde',
}: {
  players: { id: string; nickname: string; isBot?: boolean }[];
  doneIds: string[];
  meId?: string | null;
  verb?: string;
}) {
  const humans = players.filter((p) => !p.isBot);
  const done = new Set(doneIds);
  const pending = humans.filter((p) => !done.has(p.id));
  return (
    <View style={styles.box}>
      {humans.map((p) => {
        const ok = done.has(p.id);
        return (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.mark, ok ? styles.ok : styles.wait]}>
              {ok ? '✓' : '…'}
            </Text>
            <Text style={[styles.name, ok ? styles.nameOk : styles.nameWait]}>
              {p.nickname}
              {meId === p.id ? ' · tú' : ''}
            </Text>
            <Text style={ok ? styles.tagOk : styles.tagWait}>
              {ok ? 'listo' : `espera que ${verb}`}
            </Text>
          </View>
        );
      })}
      {pending.length ? (
        <Text style={styles.foot}>
          Falta{pending.length === 1 ? '' : 'n'}:{' '}
          {pending.map((p) => p.nickname).join(', ')}
        </Text>
      ) : (
        <Text style={styles.foot}>Todos listos</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
    gap: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 18, fontWeight: '900', fontSize: 16 },
  ok: { color: '#66BB6A' },
  wait: { color: '#FFB74D' },
  name: { flex: 1, fontWeight: '700', fontSize: 15 },
  nameOk: { color: '#E8F5E9' },
  nameWait: { color: '#FFE0B2' },
  tagOk: { color: '#81C784', fontSize: 12, fontWeight: '700' },
  tagWait: { color: '#FFCC80', fontSize: 12, fontWeight: '700' },
  foot: { marginTop: 6, color: '#BBB', fontSize: 13, fontWeight: '700' },
});
