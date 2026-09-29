import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

/** Stagger bot ready marks so they feel fast & synced (not all at once). */
const BOT_STAGGER_MS = 420;
const BOT_STAGGER_BASE_MS = 280;

export function WaitingRoster({
  players,
  doneIds,
  meId,
  verb = 'responda',
  mineWaitLabel,
}: {
  players: { id: string; nickname: string; isBot?: boolean }[];
  doneIds: string[];
  meId?: string | null;
  verb?: string;
  mineWaitLabel?: string;
}) {
  const { colors, fontFamily } = useTheme();
  const doneKey = doneIds.join('|');
  const done = useMemo(() => new Set(doneIds), [doneKey]);
  const roster = players.filter((p) => p && p.id);
  const bots = roster.filter((p) => p.isBot);
  const botDoneKey = bots
    .filter((b) => done.has(b.id))
    .map((b) => b.id)
    .join('|');
  const t0Ref = useRef(Date.now());
  const prevBotDone = useRef('');
  if (botDoneKey !== prevBotDone.current) {
    // New bot became done → restart stagger clock once
    if (botDoneKey.length > prevBotDone.current.length) {
      t0Ref.current = Date.now();
    }
    prevBotDone.current = botDoneKey;
  }
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!botDoneKey) return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [botDoneKey]);
  const elapsed = now - t0Ref.current;

  const botRevealAt = new Map<string, number>();
  bots.forEach((b, i) => {
    botRevealAt.set(b.id, BOT_STAGGER_BASE_MS + i * BOT_STAGGER_MS);
  });

  const pending = roster.filter((p) => {
    if (!done.has(p.id)) return true;
    if (p.isBot) {
      const need = botRevealAt.get(p.id) ?? 0;
      return elapsed < need;
    }
    return false;
  });

  return (
    <View
      style={[
        styles.box,
        { borderColor: colors.border, backgroundColor: colors.bgElevated },
      ]}
    >
      {roster.map((p) => {
        const submitted = done.has(p.id);
        const botDelay = p.isBot ? botRevealAt.get(p.id) ?? 0 : 0;
        const ok = submitted && (!p.isBot || elapsed >= botDelay);
        const waitingBot = p.isBot && !ok;
        const tone = ok ? colors.success : colors.text;
        return (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.mark, { color: tone, fontFamily }]}>
              {ok ? '✓' : waitingBot ? '…' : '·'}
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
              {ok
                ? 'listo'
                : waitingBot
                  ? 'rápido…'
                  : meId === p.id && mineWaitLabel
                    ? mineWaitLabel
                    : `espera que ${verb}`}
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
