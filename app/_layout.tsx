import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { pingDeviceDaily } from '@/src/store/deviceId';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import 'react-native-reanimated';

import { ThemeToggle } from '@/src/components/ThemeToggle';
import { VercelMetrics } from '@/src/components/VercelMetrics';
import { GameProvider } from '@/src/store/GameContext';
import { HistoryProvider } from '@/src/store/HistoryContext';
import { AdminProvider } from '@/src/store/AdminContext';
import { ThemeProvider, useTheme } from '@/src/store/ThemeContext';
import { displayVersionLabel } from '@/src/version';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function HeaderBrand({
  title,
  goHome,
}: {
  title: string;
  goHome?: boolean;
}) {
  const { colors, fontFamily, themeId } = useTheme();
  const router = useRouter();
  // Guerrilla skin: brand title in accent orange (matches home).
  const titleColor =
    themeId === 'guerrilla' && title === 'GUERRILLA CARDS'
      ? colors.accent
      : colors.text;
  const label = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
      }}
    >
      <Text
        style={{
          color: titleColor,
          fontWeight: '800',
          fontSize: 17,
          fontFamily,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textDim,
          fontSize: 11,
          fontWeight: '700',
          fontFamily,
        }}
      >
        {displayVersionLabel()}
      </Text>
    </View>
  );
  if (!goHome) return label;
  return (
    <Pressable
      onPress={() => router.replace('/')}
      accessibilityRole="link"
      accessibilityLabel="Ir al inicio"
      hitSlop={8}
    >
      {label}
    </Pressable>
  );
}

function ThemedStack() {
  const { colors, fontFamily, themeId } = useTheme();
  const statusStyle = themeId === 'classic' ? 'dark' : 'light';

  return (
    <>
      <StatusBar style={statusStyle} />
      <VercelMetrics />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800', fontFamily, color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Guerrilla Cards', headerShown: false }}
        />
        <Stack.Screen
          name="lobby"
          options={{
            title: 'GUERRILLA CARDS',
            headerTitle: () => (
              <HeaderBrand title="GUERRILLA CARDS" goHome />
            ),
          }}
        />
        <Stack.Screen
          name="play"
          options={{
            title: 'GUERRILLA CARDS',
            headerBackVisible: false,
            headerTitle: () => (
              <HeaderBrand title="GUERRILLA CARDS" goHome />
            ),
            headerRight: () => <ThemeToggle compact />,
          }}
        />
        <Stack.Screen
          name="results"
          options={{
            title: 'Resultados',
            headerTitle: () => <HeaderBrand title="Resultados" />,
          }}
        />
        <Stack.Screen
          name="historial"
          options={{ title: 'Respuestas favoritas' }}
        />
        <Stack.Screen name="compartir" options={{ title: 'Compartir' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    // Deferred so it never competes with first paint.
    const t = setTimeout(() => pingDeviceDaily(), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <ThemeProvider>
      <AdminProvider>
        <GameProvider>
          <HistoryProvider>
            <ThemedStack />
          </HistoryProvider>
        </GameProvider>
      </AdminProvider>
    </ThemeProvider>
  );
}
