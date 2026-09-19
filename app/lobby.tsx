import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Chip,
  Input,
  Label,
  Loading,
  Muted,
  Screen,
  Subtitle,
  Title,
} from '@/src/components/ui';
import * as Engine from '@/src/engine/game';
import {
  addPlayerFlexible,
  startFlexible,
  withSeatCap,
} from '@/src/engine/startFlexible';
import { randomNickname } from '@/src/engine/nicknames';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/src/engine/types';
import { useGameStore } from '@/src/store/GameContext';
import {
  getMySeat,
  getMySeatSync,
  getOnlineFlag,
  joinRoom,
  pullRoom,
  pushRoom,
  setMySeat,
  setOnlineFlag,
} from '@/src/store/roomSync';
import { copyRecoveryUrl } from '@/src/components/ClaimSeat';
import { useTheme } from '@/src/store/ThemeContext';

function notify(title: string, message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}: ${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function LobbyScreen() {
  const styles = useLobbyStyles();
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { getGame, updateGame, ready, applyRemoteGame } = useGameStore();
  const gameCode = code ? String(code).toUpperCase() : '';
  const [nick, setNick] = useState(() => randomNickname());
  // Prefer sync cache so host create→lobby does not race into joinRoom.
  const [myPlayerId, setMyPlayerIdState] = useState<string | null>(() =>
    gameCode ? getMySeatSync(gameCode) : null
  );
  const [onlineRoom, setOnlineRoom] = useState(false);
  const [seatReady, setSeatReady] = useState(() =>
    gameCode ? getMySeatSync(gameCode) != null : false
  );
  const nickDirtyRef = useRef(false);
  const [remoteTried, setRemoteTried] = useState(false);
  const joiningRef = useRef(false);

  const game = ready && gameCode ? getGame(gameCode) : undefined;

  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    setSeatReady(getMySeatSync(gameCode) != null);
    void (async () => {
      const [seat, online] = await Promise.all([
        getMySeat(gameCode),
        getOnlineFlag(gameCode),
      ]);
      if (cancelled) return;
      setMyPlayerIdState(seat);
      setOnlineRoom(online);
      setSeatReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameCode]);

  useEffect(() => {
    if (!ready || !gameCode) return;
    if (game) {
      setRemoteTried(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      await setOnlineFlag(gameCode, true);
      setOnlineRoom(true);
      const res = await pullRoom(gameCode);
      if (cancelled) return;
      if (res.ok) applyRemoteGame(res.state);
      setRemoteTried(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, gameCode, game, applyRemoteGame]);

  useEffect(() => {
    if (!ready || !seatReady || !game || game.phase !== 'lobby') return;
    if (game.mode !== 'async') return;
    if (myPlayerId && game.players.some((p) => p.id === myPlayerId)) return;

    // Host just created the room: reclaim sole host seat — never join as a 2nd player.
    if (!myPlayerId) {
      const soleHost = game.players.length === 1 ? game.players[0] : null;
      if (soleHost?.isHost) {
        void (async () => {
          await setMySeat(game.code, soleHost.id);
          setMyPlayerIdState(soleHost.id);
          await setOnlineFlag(game.code, true);
          setOnlineRoom(true);
        })();
        return;
      }
    }

    if (joiningRef.current) return;
    joiningRef.current = true;
    void (async () => {
      await setOnlineFlag(game.code, true);
      setOnlineRoom(true);
      const joined = await joinRoom(game.code, nick);
      if (joined.ok) {
        applyRemoteGame(joined.state);
        await setMySeat(game.code, joined.playerId);
        setMyPlayerIdState(joined.playerId);
      } else {
        joiningRef.current = false;
        if (joined.error && joined.error !== 'not_web') {
          notify('Unirse', joined.error);
        }
      }
    })();
  }, [ready, seatReady, game, myPlayerId, nick, applyRemoteGame]);

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
      notify('Solo', e instanceof Error ? e.message : 'Error');
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

  if (!ready || (!game && !remoteTried)) return <Loading />;

  if (!game) {
    return (
      <Screen>
        <Title>Lobby perdido</Title>
        <Subtitle>
          No hay partida con ese código en el servidor. Crea la sala otra vez
          y comparte el enlace nuevo.
        </Subtitle>
        <Button title="Inicio" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (game.mode === 'solo') {
    return <Loading />;
  }

  const isAsync = game.mode === 'async';
  const isOnline = isAsync;
  const iAmHost =
    !!myPlayerId && game.players.some((p) => p.id === myPlayerId && p.isHost);

  const seatMax = Math.max(
    MIN_PLAYERS,
    Math.min(MAX_PLAYERS, game.maxPlayers ?? MAX_PLAYERS)
  );
  const judgeLabel = (game.judgeMode ?? 'zar') === 'vote' ? 'Voto' : 'Zar';
  const canStart = game.players.length >= seatMax;

  const setCap = (n: number) => {
    if (!iAmHost) return;
    if (n < game.players.length) {
      notify(
        'Sala',
        `Ya hay ${game.players.length} jugadores. Quita alguno o elige ${game.players.length} o más.`
      );
      return;
    }
    updateGame(game.code, (g) => withSeatCap(g, n));
    void (async () => {
      const g = getGame(game.code);
      if (!g) return;
      await pushRoom(g, await getMySeat(game.code));
    })();
  };

  const start = () => {
    if (!canStart) {
      notify('Lobby', `Espera a ${seatMax} jugadores (hay ${game.players.length}).`);
      return;
    }
    try {
      updateGame(game.code, (g) => startFlexible(g));
      void (async () => {
        const g = getGame(game.code);
        if (!g) return;
        await pushRoom(g, await getMySeat(game.code));
      })();
      router.replace({ pathname: '/play', params: { code: game.code } });
    } catch (e) {
      notify('Empezar', e instanceof Error ? e.message : 'Error');
    }
  };

  const modeLabel = isAsync ? 'multijugador' : game.mode === 'live' ? 'en vivo' : 'solo';

  return (
    <Screen>
      <Title>Lobby {game.code}</Title>
      <Subtitle>
        Modo {modeLabel}
        {isAsync ? ` · juez ${judgeLabel}` : ''} · Packs:{' '}
        {game.packIds.join(', ')} · Meta: {game.targetScore} Puntacos
      </Subtitle>
      <Muted>
        Online: cada jugador en su dispositivo. Comparte el enlace lobby.
        Sala para {seatMax}. Ahora {game.players.length}/{seatMax}.
      </Muted>

      {iAmHost ? (
        <>
          <Label>Esta sala es para</Label>
          <View style={styles.capRow}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={seatMax === n}
                onPress={() => setCap(n)}
              />
            ))}
          </View>
          <Muted>
            Cuando haya {seatMax} puedes empezar. Si sois menos, baja el número.
          </Muted>
        </>
      ) : null}

      <Label>
        Jugadores ({game.players.length}/{seatMax})
      </Label>
      {game.players.map((p) => (
        <View key={p.id} style={styles.seat}>
          <Text style={styles.seatName}>
            {p.nickname}
            {p.isHost ? ' · anfitrión' : ''}
            {myPlayerId === p.id ? ' · tú' : ''}
          </Text>
          {!p.isHost && iAmHost ? (
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
                  if (!g) return;
                  await pushRoom(g, await getMySeat(game.code));
                })();
              } catch (e) {
                notify(
                  'Nombre',
                  e instanceof Error ? e.message : 'No se pudo guardar'
                );
              }
            }}
          />
          {iAmHost ? (
            <>
              <Button
                title={`Copiar enlace lobby (${game.code})`}
                variant="outline"
                onPress={() => {
                  void copyRecoveryUrl(game.code).then((url) =>
                    notify('Lobby', url)
                  );
                }}
              />
              <Label>Enlaces si alguien pierde las cookies</Label>
              {game.players
                .filter((p) => !p.isBot)
                .map((p) => (
                  <Button
                    key={`link-${p.id}`}
                    title={`Copiar ${p.nickname}`}
                    variant="ghost"
                    onPress={() => {
                      void copyRecoveryUrl(game.code, p.id).then((url) =>
                        notify(p.nickname, url)
                      );
                    }}
                  />
                ))}
            </>
          ) : null}
        </>
      ) : (
        <Muted>Entrando en la sala…</Muted>
      )}

      {isOnline && !iAmHost ? (
        <Muted>
          Esperando al anfitrión
          {game.players.length < seatMax
            ? ` · ${game.players.length}/${seatMax}`
            : ' · sala llena'}
        </Muted>
      ) : (
        <Button
          title={
            !canStart
              ? `Faltan ${Math.max(0, seatMax - game.players.length)} de ${seatMax}`
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
        capRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
