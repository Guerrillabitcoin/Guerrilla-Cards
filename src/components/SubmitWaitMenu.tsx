import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

export function SubmitWaitMenu({
  players,
  doneIds,
  expected,
  meId,
  since,
}: {
  players: { id: string; nickname: string; isBot?: boolean }[];
  doneIds: string[];
  expected: number;
  meId?: string | null;
  since?: number | null;
}) {
  const { colors, fontFamily } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(id);
  }, []);
  const humans = players.filter((p) => !p.isBot);
  const done = new Set(doneIds);
  const have = humans.filter((p) => done.has(p.id)).length;
  const need = Math.max(expected, humans.length);
  const reveal = now - (since || now) >= 5000;
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
      <Text style={[styles.count, { color: colors.text, fontFamily }]}>
        {have}/{need}
      </Text>
      {humans.map((p) => {
        const ok = done.has(p.id);
        const show = ok || reveal || p.id === meId;
        return (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.mark, { color: ok ? colors.success : colors.textMuted }]}>
              {ok ? '✓' : '·'}
            </Text>
            <Text
              style={[styles.name, { color: colors.text, fontFamily, fontSize: show ? 13 : 11 }]}
              numberOfLines={1}
            >
              {show ? `${p.nickname}${p.id === meId ? ' · tú' : ''}` : '…'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: 6, padding: 8, marginTop: 8, gap: 4 },
  count: { fontWeight: '900', fontSize: 18, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 14, fontWeight: '900' },
  name: { flex: 1, fontWeight: '700' },
});
