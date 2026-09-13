import { useMemo } from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/store/ThemeContext';

export default function NotFoundScreen() {
  const styles = useNotFoundStyles();

  return (
    <>
      <Stack.Screen options={{ title: '404' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Pantalla no encontrada</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}

function useNotFoundStyles() {
  const { colors, fontFamily } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  link: { marginTop: 16 },
  linkText: { color: colors.accent, fontWeight: '700' },
}),
    [colors, fontFamily]
  );
}

