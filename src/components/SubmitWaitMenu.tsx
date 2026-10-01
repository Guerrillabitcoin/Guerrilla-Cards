import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

const BOT_STAGGER_MS = 420;
const BOT_STAGGER_BASE_MS = 280;

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
  /** Kept for stagger timing only — never hide nicknames. */
  since?: number | null;
}) {
  const { colors, fontFamily } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const roster = players.filter((p) => p && p.id);
  const done = new Set(doneIds);
  const t0 = since && since > 0 ? since : now;
  const elapsed = Math.max(0, now - t0);

  const visuallyDone = useMemo(() => {
    const out = new Set<string>();
    let botIdx = 0;
    for (const p of roster) {
      if (!done.has(p.id)) continue;
      if (p.isBot) {
        const need = BOT_STAGGER_BASE_MS + botIdx * BOT_STAGGER_MS;
        botIdx += 1;
        if (elapsed >= need) out.add(p.id);
      } else {
        out.add(p.id);
      }
    }
    return out;
  }, [roster, doneIds.join('|'), elapsed]);

  const have = visuallyDone.size;
  const need = Math.max(expected, roster.length);

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
      <Text style={[styles.count, { color: colors.text, fontFamily }]}>
        {Math.min(have, need)}/{need}
      </Text>
      {roster.map((p) => {
        const ok = visuallyDone.has(p.id);
        const submitted = done.has(p.id);
        const label = p.isBot && !ok && submitted ? 'rápido…' : ok ? 'listo' : 'espera';
        return (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.mark, { color: ok ? colors.success : colors.textMuted }]}>
              {ok ? '✓' : submitted && p.isBot ? '…' : '·'}
            </Text>
            <Text
              style={[styles.name, { color: colors.text, fontFamily }]}
              numberOfLines={1}
            >
              {`${p.nickname}${p.id === meId ? ' · tú' : ''}`}
            </Text>
            <Text style={[styles.tag, { color: colors.textMuted, fontFamily }]}>
              {label}
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
  name: { flex: 1, fontWeight: '700', fontSize: 13 },
  tag: { fontSize: 11, fontWeight: '700' },
});
