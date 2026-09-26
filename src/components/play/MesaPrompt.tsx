import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FilledPromptText } from '../FilledPromptText';

function MesaPromptInner({
  label,
  promptText,
  answers,
}: {
  label: string;
  promptText: string;
  answers: string[];
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <FilledPromptText large promptText={promptText} answers={answers} />
    </View>
  );
}

export const MesaPrompt = React.memo(MesaPromptInner);

const styles = StyleSheet.create({
  box: { marginTop: 4 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
    color: '#C45A12',
  },
});
