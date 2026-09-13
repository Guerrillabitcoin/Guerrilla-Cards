import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import 'react-native-reanimated';

import { GameProvider } from '@/src/store/GameContext';
import { HistoryProvider } from '@/src/store/HistoryContext';
import { colors } from '@/src/theme/colors';
import { APP_VERSION_LABEL } from '@/src/version';
import { VercelMetrics } from '@/src/components/VercelMetrics';

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
        <VercelMetrics />
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
                    }}
                  >
                    Partida
                  </Text>
                  <Text
                    style={{
                      color: colors.textDim,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {APP_VERSION_LABEL}
                  </Text>
                </View>
              ),
            }}
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
          <Stack.Screen
            name="report"
            options={{ title: 'Reportar fallo' }}
          />
        </Stack>
      </HistoryProvider>
    </GameProvider>
  );
}
