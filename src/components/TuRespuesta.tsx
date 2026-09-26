import { StyleSheet, Text, View } from 'react-native';
import { fillBlank } from '../engine/deck';
import { useTheme } from '../store/ThemeContext';

export function TuRespuesta({
  promptText,
  answers,
}: {
  promptText: string;
  answers: string[];
}) {
  const { fontFamily } = useTheme();
  const line = fillBlank(promptText, answers);
  if (!line.trim()) return null;
  return (
    <View style={styles.box}>
      <Text style={[styles.kicker, { fontFamily }]}>Tu respuesta</Text>
      <Text style={[styles.line, { fontFamily }]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 8, marginBottom: 6 },
  kicker: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  line: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 24,
    textDecorationLine: 'underline',
  },
});
