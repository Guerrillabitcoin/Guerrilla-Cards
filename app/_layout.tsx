import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import 'react-native-reanimated';

import { ThemeToggle } from '@/src/components/ThemeToggle';
import { VercelMetrics } from '@/src/components/VercelMetrics';
import { GameProvider } from '@/src/store/GameContext';
import { HistoryProvider } from '@/src/store/HistoryContext';
import { AdminProvider } from '@/src/store/AdminContext';
import { ThemeProvider, useTheme } from '@/src/store/ThemeContext';
import { APP_VERSION_LABEL } from '@/src/version';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

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
        <Stack.Screen name="lobby" options={{ title: 'Lobby' }} />
        <Stack.Screen
          name="play"
          options={{
            title: 'Partida',
            headerBackVisible: false,
            headerTitle: () => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: '800',
                    fontSize: 17,
                    fontFamily,
                  }}
                >
                  Partida
                </Text>
                <Text
                  style={{
                    color: colors.textDim,
                    fontSize: 11,
                    fontWeight: '700',
                    fontFamily,
                  }}
                >
                  {APP_VERSION_LABEL}
                </Text>
              </View>
            ),
            headerRight: () => <ThemeToggle compact />,
          }}
        />
        <Stack.Screen name="results" options={{ title: 'Resultados' }} />
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
