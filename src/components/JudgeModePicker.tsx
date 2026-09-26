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
  const { colors, fontFamily } = useTheme();
  const vote = mode === 'vote';
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
      <Text style={[styles.label, { color: colors.textMuted, fontFamily }]}>Cómo se elige el ganador</Text>
      <View style={styles.row}>
        <Pressable
          disabled={!canEdit}
          onPress={() => onChange?.('zar')}
          style={[styles.chip, { borderColor: colors.border }, !vote && { backgroundColor: colors.zar || '#FFC857' }]}
        >
          <Text style={[styles.chipTxt, { fontFamily, color: !vote ? '#1A0A00' : colors.text }]}>Zar</Text>
        </Pressable>
        <Pressable
          disabled={!canEdit}
          onPress={() => onChange?.('vote')}
          style={[styles.chip, { borderColor: colors.border }, vote && { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.chipTxt, { fontFamily, color: vote ? '#FFF' : colors.text }]}>Voto</Text>
        </Pressable>
      </View>
      <Text style={[styles.help, { color: colors.textMuted, fontFamily }]}>
        {vote
          ? 'Voto: todos tiran carta y todos votan. Nadie es juez. Empate a 2-3 = voto dividido (0 puntos).'
          : 'Zar: un jugador no tira. Elige la frase ganadora. El ganador será el siguiente Zar.'}
      </Text>
      {!canEdit ? (
        <Text style={[styles.help, { color: colors.textDim, fontFamily }]}>
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
