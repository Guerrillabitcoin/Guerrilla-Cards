import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JudgeMode } from '../engine/types';
import { useTheme } from '../store/ThemeContext';

export function JudgeModePicker({
  mode,
  onChange,
  canEdit,
}: {
  mode: JudgeMode;
  onChange?: (mode: JudgeMode) => void;
  canEdit: boolean;
}) {
  const { colors, fontFamily, themeId } = useTheme();
  const vote = mode === 'vote';
  const onInk = themeId === 'classic' ? '#FFFFFF' : '#1A0A00';
  const offInk = colors.text;
  const zarBg = !vote ? colors.accent : colors.bgCard;
  const voteBg = vote ? colors.accent : colors.bgCard;
  const zarInk = !vote ? '#FFFFFF' : offInk;
  const voteInk = vote ? '#FFFFFF' : offInk;
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
      <Text style={[styles.label, { color: colors.text, fontFamily }]}>
        Cómo se elige el ganador
      </Text>
      <View style={styles.row}>
        <Pressable
          disabled={!canEdit}
          onPress={() => onChange?.('zar')}
          style={[styles.chip, { borderColor: colors.accent, backgroundColor: zarBg }]}
        >
          <Text style={[styles.chipTxt, { fontFamily, color: zarInk }]}>Zar</Text>
        </Pressable>
        <Pressable
          disabled={!canEdit}
          onPress={() => onChange?.('vote')}
          style={[styles.chip, { borderColor: colors.accent, backgroundColor: voteBg }]}
        >
          <Text style={[styles.chipTxt, { fontFamily, color: voteInk }]}>Voto</Text>
        </Pressable>
      </View>
      <Text style={[styles.help, { color: colors.text, fontFamily }]}>
        {vote
          ? 'Voto: todos tiran carta y todos votan. Nadie es juez. Empate a 2-3 = voto dividido (0 puntos).'
          : 'Zar: un jugador no tira. Elige la frase ganadora. El ganador será el siguiente Zar.'}
      </Text>
      {!canEdit ? (
        <Text style={[styles.help, { color: colors.textMuted, fontFamily }]}>
          Solo el anfitrión lo cambia antes de Empezar.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: 8, padding: 10, marginBottom: 10, gap: 8 },
  label: { fontWeight: '800', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 2, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  chipTxt: { fontWeight: '900', fontSize: 16 },
  help: { fontWeight: '700', fontSize: 13, lineHeight: 18 },
});
