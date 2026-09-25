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
import { LobbyShareCard } from '@/src/components/LobbyShareCard';
import { LobbyJoinBar } from '@/src/components/LobbyJoinBar';import { renameRoom } from '@/src/store/renameRoom';import { useTheme } from '@/src/store/ThemeContext';

function notify(title: string, message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}: ${message}`);
    return;
  }
  Alert.alert(title, message);
}

/** Dedupe StrictMode / remount double-joins per room code (module scope). */
const lobbyJoinInFlight = new Set<string>();

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

    // Guests (no seat cookie) must always joinRoom as a NEW seat.
    // Host create already awaits setMySeat before navigating — do NOT reclaim
    // sole host here or invite links steal the host seat when players.length===1.
    const codeKey = game.code.trim().toUpperCase();
    if (joiningRef.current || lobbyJoinInFlight.has(codeKey)) return;
    joiningRef.current = true;
    lobbyJoinInFlight.add(codeKey);
    let cancelled = false;
    void (async () => {
      try {
        await setOnlineFlag(game.code, true);
        if (cancelled) return;
        setOnlineRoom(true);
        // Fresh pull so we don't join on a stale local roster / wrong cap
        const pulled = await pullRoom(game.code);
        if (cancelled) return;
        if (pulled.ok) applyRemoteGame(pulled.state);
        const live = pulled.ok ? pulled.state : game;
        if (live.phase !== 'lobby') {
          joiningRef.current = false;
          lobbyJoinInFlight.delete(codeKey);
          return;
        }
        // Seat cookie from an older session for this code: clear if not in roster
        if (myPlayerId && !live.players.some((p) => p.id === myPlayerId)) {
          // fall through to join as new seat
        }
        const cap = Math.max(
          2,
          Math.min(8, Number(live.maxPlayers) || 8)
        );
        if ((live.players?.length ?? 0) >= cap) {
          joiningRef.current = false;
          lobbyJoinInFlight.delete(codeKey);
          notify('Unirse', 'Sala llena');
          return;
        }
        const joined = await joinRoom(game.code, nick);
        if (cancelled) return;
        if (joined.ok) {
          applyRemoteGame(joined.state);
          await setMySeat(game.code, joined.playerId);
          setMyPlayerIdState(joined.playerId);
          // Keep inFlight until seat confirmed in roster (prevents StrictMode double seat)
          const confirmed = joined.state.players.some(
            (p) => p.id === joined.playerId
          );
          if (!confirmed) {
            joiningRef.current = false;
            lobbyJoinInFlight.delete(codeKey);
          }
        } else {
          joiningRef.current = false;
          lobbyJoinInFlight.delete(codeKey);
          if (joined.error && joined.error !== 'not_web') {
            const msg =
              joined.error === 'lobby_full'
                ? 'Sala llena'
                : joined.error === 'join_busy'
                  ? 'Sala ocupada, reintenta'
                  : joined.error === 'not_lobby'
                    ? 'La partida ya empezó'
                    : joined.error;
            notify('Unirse', msg);
          }
        }
      } catch {
        joiningRef.current = false;
        lobbyJoinInFlight.delete(codeKey);
      }
    })();
        return () => {
      cancelled = true;
      joiningRef.current = false;
      lobbyJoinInFlight.delete(codeKey);
    };
  }, [ready, seatReady, game, myPlayerId, nick, applyRemoteGame]);

  useEffect(() => {
    if (!gameCode || !myPlayerId || !game) return;
    if (game.players.some((p) => p.id === myPlayerId)) {
      lobbyJoinInFlight.delete(gameCode);
      joiningRef.current = false;
    }
  }, [gameCode, myPlayerId, game?.players]);

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
      <LobbyShareCard
        code={game.code}
        seated={game.players.length}
        cap={seatMax}
        onCopy={() => {
          void copyRecoveryUrl(game.code).then((url) => notify('Lobby', url));
        }}
      />      <Subtitle>
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
      {(!myPlayerId ||
        !game.players.some((p) => p.id === myPlayerId)) &&
      game.phase === 'lobby' ? (
        <LobbyJoinBar
          onJoin={() => {
            void (async () => {
              const joined = await joinRoom(game.code, nick);
              if (!joined.ok) {
                notify(
                  'Unirse',
                  joined.error === 'lobby_full'
                    ? 'Sala llena — el anfitrión puede subir el número'
                    : joined.error
                );
                return;
              }
              applyRemoteGame(joined.state);
              await setMySeat(game.code, joined.playerId);
              setMyPlayerIdState(joined.playerId);
            })();
          }}
        />
      ) : null}
      {game.players.map((p) => (        <View key={p.id} style={styles.seat}>
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
              void (async () => {
                try {
                  const nextNick = nick.trim() || randomNickname();
                  const renamed = await renameRoom(
                    game.code,
                    myPlayerId,
                    nextNick
                  );
                  if (!renamed.ok) {
                    notify('Nombre', renamed.error);
                    return;
                  }
                  applyRemoteGame(renamed.state);
                  setNick(nextNick);
                  nickDirtyRef.current = false;
                } catch (e) {
                  notify(
                    'Nombre',
                    e instanceof Error ? e.message : 'No se pudo guardar'
                  );
                }
              })();
            }}
          />
                    {iAmHost ? (
            <>
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
