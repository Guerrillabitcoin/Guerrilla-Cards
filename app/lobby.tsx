import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useMemo, useRef } from 'react';
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
import { randomNickname } from '@/src/engine/nicknames';
import {
  ASYNC_TARGET_PLAYERS,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from '@/src/engine/types';
import { useGameStore } from '@/src/store/GameContext';
import {
  getMySeat,
  getOnlineFlag,
  pullRoom,
  pushRoom,
  setMySeat,
} from '@/src/store/roomSync';
import { useTheme } from '@/src/store/ThemeContext';

export default function LobbyScreen() {
  const styles = useLobbyStyles();

  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { getGame, updateGame, ready, applyRemoteGame } = useGameStore();
  const [nick, setNick] = useState(() => randomNickname());
  const [myPlayerId, setMyPlayerIdState] = useState<string | null>(null);
  const [onlineRoom, setOnlineRoom] = useState(false);
  const nickDirtyRef = useRef(false);

  const gameCode = code ? String(code).toUpperCase() : '';
  const game = ready && gameCode ? getGame(gameCode) : undefined;

  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    void (async () => {
      const [seat, online] = await Promise.all([
        getMySeat(gameCode),
        getOnlineFlag(gameCode),
      ]);
      if (cancelled) return;
      setMyPlayerIdState(seat);
      setOnlineRoom(online);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameCode]);

  useEffect(() => {
    if (!game || !myPlayerId) return;
    if (nickDirtyRef.current) return;
    const me = game.players.find((p) => p.id === myPlayerId);
    if (me?.nickname) setNick(me.nickname);
  }, [game?.code, myPlayerId, game?.players]);

  useEffect(() => {
    if (!ready || !gameCode || !onlineRoom) return;
    let cancelled = false;
    const tick = async () => {
      const res = await pullRoom(gameCode);
      if (cancelled || !res.ok) return;
      applyRemoteGame(res.state);
    };
    void tick();
    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, gameCode, onlineRoom, applyRemoteGame]);

  useEffect(() => {
    if (!ready || !game || game.mode !== 'solo' || game.phase !== 'lobby') return;
    try {
      updateGame(game.code, (g) => {
        let next = g;
        if (next.players.filter((p) => p.isBot).length === 0) {
          next = Engine.addSoloBots(next);
        }
        if (next.players.length >= 1) {
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

  useEffect(() => {
    if (!ready || !game || !onlineRoom) return;
    if (game.phase !== 'lobby' && game.phase !== 'results') {
      router.replace({ pathname: '/play', params: { code: game.code } });
    }
  }, [ready, game?.phase, game?.code, onlineRoom, router]);

  if (!ready) return <Loading />;

  if (!game) {
    return (
      <Screen>
        <Title>Lobby perdido</Title>
        <Subtitle>
          No hay partida con ese código aquí
          {onlineRoom ? ' ni en el servidor' : ' en este dispositivo'}.
        </Subtitle>
        <Button title="Inicio" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (game.mode === 'solo') {
    return <Loading />;
  }

  const isAsync = game.mode === 'async';
  const isOnline = isAsync && onlineRoom;

  const addSeat = () => {
    try {
      let addedId: string | null = null;
      const seatNick = nick.trim() || randomNickname();
      updateGame(game.code, (g) => {
        const before = new Set(g.players.map((p) => p.id));
        const next = Engine.addPlayer(g, seatNick);
        const neu = next.players.find((p) => !before.has(p.id));
        addedId = neu?.id ?? null;
        return next;
      });
      setNick(randomNickname());
      if (isOnline && addedId && !myPlayerId) {
        void setMySeat(game.code, addedId).then(() =>
          setMyPlayerIdState(addedId)
        );
      }
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
    game.mode === 'live' ? 'en vivo' : game.mode === 'async' ? 'multijugador' : 'solo';
  const seatMax = Math.max(
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, game.maxPlayers ?? (isAsync ? ASYNC_TARGET_PLAYERS : MAX_PLAYERS))
  );
  const seatMin = MIN_PLAYERS;
  const judgeLabel = (game.judgeMode ?? 'zar') === 'vote' ? 'Voto' : 'Zar';
  const canStart = game.players.length >= seatMin;
  const iAmHost =
    !!myPlayerId && game.players.some((p) => p.id === myPlayerId && p.isHost);

  return (
    <Screen>
      <Title>Lobby {game.code}</Title>
      <Subtitle>
        Modo {modeLabel}
        {isAsync ? ` · juez ${judgeLabel}` : ''} · Packs:{' '}
        {game.packIds.join(', ')} · Meta: {game.targetScore} Puntacos
      </Subtitle>
      <Muted>
        {isOnline
          ? `Online: comparte el código ${game.code}. Cada jugador entra desde su dispositivo (${seatMin}–${seatMax}).`
          : isAsync
            ? `Multijugador: ${seatMin}–${seatMax} jugadores. El código ${game.code} sirve para retomar.`
            : `Añade ${MIN_PLAYERS}–${MAX_PLAYERS} asientos en este móvil.`}
      </Muted>

      <Label>
        Jugadores ({game.players.length}
        {isAsync ? `/${seatMax}` : ''})
      </Label>
      {game.players.map((p) => (
        <View key={p.id} style={styles.seat}>
          <Text style={styles.seatName}>
            {p.isBot ? '🤖 ' : ''}
            {p.nickname}
            {p.isHost ? ' · anfitrión' : ''}
            {myPlayerId === p.id ? ' · tú' : ''}
          </Text>
          {!p.isHost && (!isOnline || iAmHost) ? (
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

      {isOnline && myPlayerId ? (
        <>
          <Label>Tu nombre</Label>
          <Input
            value={nick}
            onChangeText={(txt) => {
              nickDirtyRef.current = true;
              setNick(txt);
            }}
            placeholder="Tu apodo"
            maxLength={42}
          />
          <Button
            title="Otro nombre raro"
            variant="ghost"
            onPress={() => {
              nickDirtyRef.current = true;
              setNick(randomNickname(nick));
            }}
          />
          <Button
            title="Guardar nombre"
            variant="outline"
            onPress={() => {
              try {
                const nextNick = nick.trim() || randomNickname();
                updateGame(game.code, (g) =>
                  Engine.renamePlayer(g, myPlayerId, nextNick)
                );
                setNick(nextNick);
                nickDirtyRef.current = false;
                void (async () => {
                  const g = getGame(game.code);
                  if (!g || g.mode !== 'async') return;
                  const seat = await getMySeat(game.code);
                  await pushRoom(g, seat);
                })();
              } catch (e) {
                Alert.alert(
                  'Nombre',
                  e instanceof Error ? e.message : 'No se pudo guardar'
                );
              }
            }}
          />
          <Muted>
            Los demás se unen desde Inicio con el código {game.code}.
          </Muted>
        </>
      ) : null}

      {!isOnline && game.players.length < seatMax ? (
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

      {isOnline && !iAmHost ? (
        <Muted>
          Esperando a que el anfitrión empiece
          {game.players.length < seatMin
            ? ` (faltan ${seatMin - game.players.length})`
            : '…'}
        </Muted>
      ) : (
        <Button
          title={
            !canStart
              ? `Faltan ${seatMin - game.players.length} jugadores`
              : 'Empezar partida'
          }
          onPress={start}
          disabled={!canStart}
        />
      )}
    </Screen>
  );
}

function useLobbyStyles() {
  const { colors, fontFamily } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
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
}),
    [colors, fontFamily]
  );
}
