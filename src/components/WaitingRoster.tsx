import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

export function WaitingRoster({
  players,
  doneIds,
  meId,
  verb = 'responda',
}: {
  players: { id: string; nickname: string; isBot?: boolean }[];
  doneIds: string[];
  meId?: string | null;
  verb?: string;
}) {
  const { colors, fontFamily } = useTheme();
  const humans = players.filter((p) => !p.isBot);
  const done = new Set(doneIds);
  const pending = humans.filter((p) => !done.has(p.id));

  return (
    <View
      style={[
        styles.box,
        { borderColor: colors.border, backgroundColor: colors.bgElevated },
      ]}
    >
      {humans.map((p) => {
        const ok = done.has(p.id);
        const tone = ok ? colors.success : colors.text;
        return (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.mark, { color: tone, fontFamily }]}>
              {ok ? '✓' : '·'}
            </Text>
            <Text
              style={[
                styles.name,
                { color: colors.text, fontFamily, opacity: ok ? 0.7 : 1 },
              ]}
              numberOfLines={1}
            >
              {p.nickname}
              {meId === p.id ? ' · tú' : ''}
            </Text>
            <Text
              style={[styles.tag, { color: colors.textMuted, fontFamily }]}
              numberOfLines={1}
            >
              {ok ? 'listo' : `espera que ${verb}`}
            </Text>
          </View>
        );
      })}
      <Text style={[styles.foot, { color: colors.textMuted, fontFamily }]}>
        {pending.length
          ? `Falta${pending.length === 1 ? '' : 'n'}: ${pending
              .map((x) => x.nickname)
              .join(', ')}`
          : 'Todos listos'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  mark: { width: 16, fontWeight: '900', fontSize: 16 },
  name: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontWeight: '800',
    fontSize: 15,
  },
  tag: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 96,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
  },
  foot: { marginTop: 4, fontSize: 13, fontWeight: '700' },
});
