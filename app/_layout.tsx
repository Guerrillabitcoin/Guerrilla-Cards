import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { GameProvider } from '@/src/store/GameContext';
import { HistoryProvider } from '@/src/store/HistoryContext';
import { colors } from '@/src/theme/colors';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GameProvider>
      <HistoryProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgElevated },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '800' },
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
            options={{ title: 'Partida', headerBackVisible: false }}
          />
          <Stack.Screen name="results" options={{ title: 'Resultados' }} />
          <Stack.Screen
            name="historial"
            options={{ title: 'Respuestas favoritas' }}
          />
          <Stack.Screen
            name="compartir"
            options={{ title: 'Compartir' }}
          />
        </Stack>
      </HistoryProvider>
    </GameProvider>
  );
}
