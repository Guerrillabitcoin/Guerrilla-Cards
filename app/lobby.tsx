import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Input,
  Label,
  Loading,
  Muted,
  Screen,
  Subtitle,
  Title,
} from '@/src/components/ui';
import * as Engine from '@/src/engine/game';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/src/engine/types';
import { useGameStore } from '@/src/store/GameContext';
import { colors } from '@/src/theme/colors';

export default function LobbyScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { getGame, updateGame, ready } = useGameStore();
  const [nick, setNick] = useState('');

  const gameCode = code ? String(code).toUpperCase() : '';
  const game = ready && gameCode ? getGame(gameCode) : undefined;

  // Solo games should skip lobby (auto-started from Home); if somehow here, start
  useEffect(() => {
    if (!ready || !game || game.mode !== 'solo' || game.phase !== 'lobby') return;
    try {
      updateGame(game.code, (g) => {
        let next = g;
        if (next.players.filter((p) => p.isBot).length === 0) {
          next = Engine.addSoloBots(next);
        }
        if (next.players.length >= MIN_PLAYERS) {
          next = Engine.startGame(next);
        }
        return next;
      });
      router.replace({ pathname: '/play', params: { code: game.code } });
    } catch (e) {
      Alert.alert('Solo', e instanceof Error ? e.message : 'Error');
    }
  }, [
    ready,
    game?.code,
    game?.mode,
    game?.phase,
    game?.players.length,
    router,
    updateGame,
  ]);

  if (!ready) return <Loading />;

  if (!game) {
    return (
      <Screen>
        <Title>Lobby perdido</Title>
        <Subtitle>No hay partida con ese código en este dispositivo.</Subtitle>
        <Button title="Inicio" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (game.mode === 'solo') {
    return <Loading />;
  }

  const addSeat = () => {
    try {
      updateGame(game.code, (g) => Engine.addPlayer(g, nick));
      setNick('');
    } catch (e) {
      Alert.alert('Jugador', e instanceof Error ? e.message : 'Error');
    }
  };

  const start = () => {
    try {
      updateGame(game.code, (g) => Engine.startGame(g));
      router.replace({ pathname: '/play', params: { code: game.code } });
    } catch (e) {
      Alert.alert('Empezar', e instanceof Error ? e.message : 'Error');
    }
  };

  const modeLabel =
    game.mode === 'live' ? 'en vivo' : game.mode === 'async' ? 'async' : 'solo';

  return (
    <Screen>
      <Title>Lobby {game.code}</Title>
      <Subtitle>
        Modo {modeLabel} · Packs: {game.packIds.join(', ')} · Meta:{' '}
        {game.targetScore} Puntacos
      </Subtitle>
      <Muted>
        Añade {MIN_PLAYERS}–{MAX_PLAYERS} asientos en este móvil. Pásalo entre
        personas en cada turno.
      </Muted>

      <Label>Jugadores ({game.players.length})</Label>
      {game.players.map((p) => (
        <View key={p.id} style={styles.seat}>
          <Text style={styles.seatName}>
            {p.isBot ? '🤖 ' : ''}
            {p.nickname}
            {p.isHost ? ' · anfitrión' : ''}
          </Text>
          {!p.isHost ? (
            <Button
              title="Quitar"
              variant="ghost"
              onPress={() =>
                updateGame(game.code, (g) => Engine.removePlayer(g, p.id))
              }
            />
          ) : null}
        </View>
      ))}

      {game.players.length < MAX_PLAYERS ? (
        <>
          <Label>Añadir asiento</Label>
          <Input
            value={nick}
            onChangeText={setNick}
            placeholder="Apodo del jugador"
            maxLength={20}
          />
          <Button title="Añadir jugador" onPress={addSeat} variant="outline" />
        </>
      ) : null}

      <Button
        title={
          game.players.length < MIN_PLAYERS
            ? `Faltan ${MIN_PLAYERS - game.players.length} jugadores`
            : 'Empezar partida'
        }
        onPress={start}
        disabled={game.players.length < MIN_PLAYERS}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seatName: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
