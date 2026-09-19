import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Button,
  Chip,
  Input,
  Label,
  Muted,
  PackTile,
  Screen,
  Subtitle,
} from '@/src/components/ui';
import { countCombinedDeck, getBannedCount, getPlayablePackMeta } from '@/src/engine/deck';
import {
  SOLO_DEFAULT_TARGET,
  type GameMode,
  type JudgeMode,
} from '@/src/engine/types';
import { useGameStore } from '@/src/store/GameContext';
import {
  claimSeat,
  getMySeat,
  joinRoom,
  listOpenRooms,
  pullRoom,
  pushRoom,
  setMySeat,
  setOnlineFlag,
  type OpenRoomRow,
} from '@/src/store/roomSync';
import { randomNickname } from '@/src/engine/nicknames';
import * as Engine from '@/src/engine/game';
import { useTheme } from '@/src/store/ThemeContext';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { APP_VERSION_LABEL } from '@/src/version';
function notify(title: string, message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}: ${message}`);
    return;
  }
  Alert.alert(title, message);
}
import { ClaimSeat } from '@/src/components/ClaimSeat';
import type { GameState } from '@/src/engine/types';

function shortPackTitle(id: string, title: string): string {
  const aliases: Record<string, string> = {
    core: 'Core',
    celebridades: 'Famosos',
    drogas: 'Drogas',
    plus18: 'Plus18',
    politica: 'Política',
    economia: 'Economía',
    animales: 'Animales',
    sexo: 'Sexo',
    familia: 'Familia',
    religion: 'Religión',
    tech: 'Tech',
    salud: 'Salud',
    espana: 'España',
  };
  if (aliases[id]) return aliases[id];
  return title.replace(/^Guerrilla\s+/i, '').replace(/\s*&\s*.*$/, '').trim();
}

const ADULT_OK_KEY = 'guerrilla_adult_ok_v1';

export default function HomeScreen() {
  const styles = useHomeStyles();
  const router = useRouter();
  const {
    createGame,
    createAndStartSolo,
    joinOrOpen,
    saveGame,
    updateGame,
    getGame,
    games,
    ready,
  } = useGameStore();
  const packs = useMemo(
    () => getPlayablePackMeta().filter((p) => p.id !== '_banned'),
    []
  );
  const { width: winW } = useWindowDimensions();
  const denseMenu = winW >= 900;
  const mobileCompact = winW < 700;
  const packCols = mobileCompact ? 4 : winW >= 1400 ? 7 : winW >= 1100 ? 6 : winW >= 900 ? 6 : 5;
  const packCellWidthPct =
    `${(100 - (packCols - 1) * (mobileCompact ? 2 : 1.2)) / packCols}%` as `${number}%`;
  const ADULT_IDS = useMemo(() => new Set(['plus18', 'sexo', 'drogas', 'religion']), []);
  const temaIds = useMemo(
    () => packs.filter((p) => !ADULT_IDS.has(p.id)).map((p) => p.id),
    [packs, ADULT_IDS]
  );
  const adultIds = useMemo(
    () => packs.filter((p) => ADULT_IDS.has(p.id)).map((p) => p.id),
    [packs, ADULT_IDS]
  );

  const [nickname, setNickname] = useState(() => randomNickname());
  const [joinCode, setJoinCode] = useState('');
    const [claimGame, setClaimGame] = useState<GameState | null>(null);
  const urlParams = useLocalSearchParams<{ code?: string; seat?: string }>();
  const [mode, setMode] = useState<GameMode>('solo');
  const [judgeMode, setJudgeMode] = useState<JudgeMode>('zar');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [openRooms, setOpenRooms] = useState<OpenRoomRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetScore, setTargetScore] = useState(String(SOLO_DEFAULT_TARGET));
  const [adultOk, setAdultOk] = useState(false);

  useEffect(() => {
    setSelected((prev) => (prev.length === 0 && temaIds.length ? temaIds : prev));
  }, [temaIds]);

  useEffect(() => {
    void AsyncStorage.getItem(ADULT_OK_KEY).then((v) => {
      if (v === '1') setAdultOk(true);
    });
  }, []);

  useEffect(() => {
    if (mode !== 'async' || Platform.OS !== 'web') {
      setOpenRooms([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void listOpenRooms().then((res) => {
        if (!cancelled && res.ok) setOpenRooms(res.rooms);
      });
    };
    load();
    const timer = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode]);

  const markAdultOk = useCallback(() => {
    setAdultOk(true);
    void AsyncStorage.setItem(ADULT_OK_KEY, '1');
  }, []);

  const confirmAdult = useCallback(
    (onYes: () => void) => {
      if (adultOk) {
        onYes();
        return;
      }
      const msg =
        'Estos packs incluyen humor negro, sexo, drogas u otros temas para adultos. ¿Confirmas que eres mayor de 18 años?';
      if (Platform.OS === 'web') {
        const w = globalThis as { confirm?: (s: string) => boolean };
        if (w.confirm?.(msg)) {
          markAdultOk();
          onYes();
        }
        return;
      }
      Alert.alert('Contenido +18', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Soy mayor de 18', onPress: () => { markAdultOk(); onYes(); } },
      ]);
    },
    [adultOk, markAdultOk]
  );

  const selectedPlayable = useMemo(() => selected.filter((id) => id !== '_banned'), [selected]);
  const selectedSet = useMemo(() => new Set(selectedPlayable), [selectedPlayable]);
  const selectedKey = useMemo(() => selectedPlayable.slice().sort().join('|'), [selectedPlayable]);
  const selectedDeckCounts = useMemo(() => {
    const c = countCombinedDeck(selectedPlayable.length ? selectedPlayable : ['core']);
    return { prompts: c.prompts, answers: c.answers, packs: selectedPlayable.length || 1 };
  }, [selectedKey, selectedPlayable]);
  const bannedCount = useMemo(() => getBannedCount(), []);
  const allTemasOn = temaIds.length > 0 && temaIds.every((id) => selectedSet.has(id));
  const allAdultOn = adultIds.length > 0 && adultIds.every((id) => selectedSet.has(id));

  const applyTogglePack = (id: string) => {
    setSelected((prev) => {
      const clean = prev.filter((x) => x !== '_banned');
      if (clean.includes(id)) {
        if (clean.length === 1) return clean;
        return clean.filter((x) => x !== id);
      }
      return [...clean, id];
    });
  };

  const togglePack = (id: string) => {
    if (id === '_banned') return;
    const turningOn = !selectedSet.has(id);
    if (turningOn && ADULT_IDS.has(id)) {
      confirmAdult(() => applyTogglePack(id));
      return;
    }
    applyTogglePack(id);
  };

  const toggleTemasCore = () => {
    setSelected((prev) => {
      const clean = prev.filter((x) => x !== '_banned');
      const withoutTemas = clean.filter((id) => !temaIds.includes(id));
      if (temaIds.every((id) => clean.includes(id))) {
        return [...new Set([...withoutTemas, 'core'])];
      }
      return [...new Set([...withoutTemas, ...temaIds])];
    });
  };

  const applyToggleTemas18 = () => {
    setSelected((prev) => {
      const clean = prev.filter((x) => x !== '_banned');
      const withoutAdult = clean.filter((id) => !adultIds.includes(id));
      if (adultIds.every((id) => clean.includes(id))) {
        const next = withoutAdult;
        return next.length ? next : temaIds.length ? temaIds : ['core'];
      }
      return [...new Set([...withoutAdult, ...adultIds])];
    });
  };

  const toggleTemas18 = () => {
    if (allAdultOn) {
      applyToggleTemas18();
      return;
    }
    confirmAdult(() => applyToggleTemas18());
  };

  const parseTarget = () => {
    const n = parseInt(targetScore, 10);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      throw new Error('La meta debe ser un número entre 1 y 20.');
    }
    return n;
  };

  const openGame = (code: string, phase: string) => {
    if (phase === 'lobby') router.push({ pathname: '/lobby', params: { code } });
    else if (phase === 'results') router.push({ pathname: '/results', params: { code } });
    else router.push({ pathname: '/play', params: { code } });
  };

  const resolveNick = () => {
    const n = nickname.trim();
    if (n) return n;
    const gen = randomNickname();
    setNickname(gen);
    return gen;
  };

  const startSoloNow = () => {
    try {
      if (!ready) {
        notify('Un momento', 'Cargando mazo y partidas guardadas…');
        return;
      }
      const nick = resolveNick();
      const target = parseTarget();
      const game = createAndStartSolo({
        hostNickname: nick,
        packIds: selectedPlayable,
        targetScore: target,
      });
      openGame(game.code, game.phase);
    } catch (e) {
      notify('Error', e instanceof Error ? e.message : 'No se pudo crear');
    }
  };

  const startAsyncNow = () => {
    if (!ready) {
      notify('Un momento', 'Cargando mazo y partidas guardadas…');
      return;
    }
    void (async () => {
      try {
        const nick = resolveNick();
        const target = parseTarget();
        const game = createGame({
          hostNickname: nick,
          mode: 'async',
          packIds: selectedPlayable,
          targetScore: target,
          judgeMode: maxPlayers === 2 ? 'vote' : judgeMode,
          maxPlayers,
        });
        const hostId = game.players[0]?.id;
        if (hostId) await setMySeat(game.code, hostId);
        const pushed = await pushRoom(game, hostId);
        if (pushed.ok) await setOnlineFlag(game.code, true);
        else if (pushed.error === 'kv_not_configured') {
          notify(
            'Sin KV',
            'No hay KV_REST_API_URL/TOKEN en Vercel. La partida queda en este dispositivo (pass-and-play).'
          );
          await setOnlineFlag(game.code, false);
        } else await setOnlineFlag(game.code, false);
        openGame(game.code, game.phase);
      } catch (e) {
        notify('Error', e instanceof Error ? e.message : 'No se pudo crear');
      }
    })();
  };

  const onCreate = () => {
    const run = mode === 'async' ? startAsyncNow : startSoloNow;
    if (mode !== 'async') setMode('solo');
    const needsAdult = selectedPlayable.some((id) => ADULT_IDS.has(id));
    if (needsAdult && !adultOk) {
      confirmAdult(() => run());
      return;
    }
    run();
  };

  const onJoin = (codeOverride?: string, seatOverride?: string) => {
    const code = (codeOverride || joinCode).trim().toUpperCase();
    const wantSeat = (seatOverride || '').trim();
    if (!code) {
      notify('Código', 'Introduce el código de la partida.');
      return;
    }
    setJoinCode(code);
    void (async () => {
      try {
        if (wantSeat) {
          const claimed = await claimSeat(code, wantSeat);
          if (claimed.ok) {
            saveGame(claimed.state, { sync: false });
            await setOnlineFlag(code, true);
            await setMySeat(code, claimed.playerId);
            setClaimGame(null);
            openGame(claimed.state.code, claimed.state.phase);
            return;
          }
          notify('Asiento', claimed.error || 'No se pudo reclamar');
        }
        const desiredNick = resolveNick();
        const joined = await joinRoom(code, desiredNick);
        if (joined.ok) {
          const me = joined.state.players.find((p) => p.id === joined.playerId);
          if (me?.nickname) setNickname(me.nickname);
          saveGame(joined.state, { sync: false });
          await setOnlineFlag(code, true);
          await setMySeat(code, joined.playerId);
          openGame(joined.state.code, joined.state.phase);
          return;
        }
        if (joined.error === 'kv_not_configured') {
          notify('Sin KV', 'El servidor no tiene KV configurado.');
          return;
        }
        if (joined.error === 'not_found') {
          notify('No encontrada', 'No hay sala online con ese código.');
          return;
        }
        if (joined.error === 'lobby_full') {
          notify('Sala llena', 'No quedan huecos.');
          return;
        }
        if (joined.error === 'not_lobby') {
          const seat = await getMySeat(code);
          if (seat) {
            const claimed = await claimSeat(code, seat);
            if (claimed.ok) {
              saveGame(claimed.state, { sync: false });
              await setOnlineFlag(code, true);
              await setMySeat(code, claimed.playerId);
              openGame(claimed.state.code, claimed.state.phase);
              return;
            }
          }
         const live = await pullRoom(code);
          if (live.ok) {
            saveGame(live.state, { sync: false });
            await setOnlineFlag(code, true);
            setClaimGame(live.state);
            notify('Asiento', 'Elige quién eres en la lista de abajo.');
            return;
          }
          notify('Partida empezada', 'Pide al anfitrión tu enlace de jugador.');
          return;
        }
        const remote = await pullRoom(code);
        if (remote.ok) {
          saveGame(remote.state, { sync: false });
          await setOnlineFlag(code, true);
          const g = remote.state;
          const seat = await getMySeat(code);
          if (seat && g.players.some((p) => p.id === seat)) {
            openGame(g.code, g.phase);
            return;
          }
          if (g.phase !== 'lobby') {
            // Mid-game without cookie → claim UI, never invent a seat
            setClaimGame(g);
            notify('Asiento', 'Elige quién eres en la lista de abajo.');
            return;
          }
          // Lobby but atomic join failed: do not create a ghost seat locally
          notify(
            'Unirse',
            joined.error && joined.error !== 'not_web'
              ? `No se pudo unir (${joined.error}). Reintenta.`
              : 'No se pudo unir. Reintenta el código.'
          );
          return;
        }
        notify('Unirse', joined.error && joined.error !== 'not_web' ? `No se pudo unir (${joined.error}).` : 'No hay partida con ese código.');
      } catch (e) {
        notify('Unirse', e instanceof Error ? e.message : 'No se pudo unir');
      }
    })();
  };

  const recent = Object.values(games).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const modeHint =
    mode === 'async'
      ? 'Multijugador: 2–8 personas, un código. 2 jugadores siempre votan. Salas con hueco salen abajo.'
      : 'Solo = tú respondes cada ronda y juzgas. Los rivales se rellenan al azar del mazo.';

  return (
    <Screen style={denseMenu ? styles.screenDense : undefined} contentDense={denseMenu}>
      <View style={styles.brandTop}>
        <ThemeToggle />
      </View>
      <View style={styles.brandRow}>
        <Text style={[styles.brandTitle, denseMenu && styles.brandTitleDense]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          GUERRILLA CARDS
        </Text>
        <Text style={styles.brandVersion}>{APP_VERSION_LABEL}</Text>
      </View>
      <Subtitle style={denseMenu ? styles.subDense : undefined}>
        Juego de humor negro en español. Rellena los huecos de las preguntas con disparatadas e ingeniosas respuestas.
      </Subtitle>
      <Muted style={styles.localNotice}>
        {Platform.OS === 'web'
          ? 'Las partidas se guardan solo en este navegador. Si borras datos del sitio o cambias de dispositivo, se pierden.'
          : 'Las partidas se guardan solo en este dispositivo.'}
      </Muted>
      <Label>Tu apodo (aleatorio al entrar)</Label>
      <Input value={nickname} onChangeText={setNickname} placeholder="ComidaADomicilio" autoCapitalize="none" maxLength={42} />
      <Button title="Otro nombre raro" variant="ghost" onPress={() => setNickname(randomNickname(nickname))} />
      <Label>Modo</Label>
      <View style={[styles.row, styles.modeRow, mobileCompact && styles.modeRowMobile]}>
        <Chip label="Solo" selected={mode === 'solo'} onPress={() => { setMode('solo'); setTargetScore(String(SOLO_DEFAULT_TARGET)); }} />
        <Chip label="Multijugador" selected={mode === 'async'} onPress={() => { setMode('async'); setTargetScore(String(SOLO_DEFAULT_TARGET)); }} />
        <Chip label="Reto semanal" selected={false} disabled badge="próximamente" onPress={() => {}} />
      </View>
      <Muted>{modeHint}</Muted>
      {mode === 'async' ? (
        <>
          <Label>Jugadores (2–8)</Label>
          <View style={[styles.row, styles.modeRow]}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Chip key={n} label={String(n)} selected={maxPlayers === n} onPress={() => { setMaxPlayers(n); if (n === 2) setJudgeMode('vote'); }} />
            ))}
          </View>
          <Label>Juez de la ronda</Label>
          <View style={[styles.row, styles.modeRow]}>
            <Chip label="Zar" selected={judgeMode === 'zar'} disabled={maxPlayers === 2} onPress={() => { if (maxPlayers !== 2) setJudgeMode('zar'); }} />
            <Chip label="Voto" selected={judgeMode === 'vote' || maxPlayers === 2} onPress={() => setJudgeMode('vote')} />
          </View>
          <Muted>
            {maxPlayers === 2 || judgeMode === 'vote'
              ? 'Todos votan (sin votar la propia). Con 2 jugadores siempre es voto.'
              : 'Un Zar elige la mejor jugada; el ganador será el próximo Zar.'}
          </Muted>
          <Label>Salas con hueco</Label>
          {openRooms.length === 0 ? (
            <Muted>Ninguna sala abierta ahora. Crea una o pega un código.</Muted>
          ) : (
            openRooms.map((r) => (
              <Button key={r.code} title={`${r.code} · ${r.seated}/${r.maxPlayers} · ${r.players.join(', ') || 'vacía'}`} variant="ghost" onPress={() => onJoin(r.code)} />
            ))
          )}
          <Label>Código de partida</Label>
          <Input value={joinCode} onChangeText={setJoinCode} placeholder="ABC12" autoCapitalize="characters" maxLength={8} />
           <Button title="Unirse" onPress={() => onJoin()} variant="outline" />
          {claimGame ? (
            <ClaimSeat
              game={claimGame}
              onPick={(id) => onJoin(claimGame.code, id)}
            />
          ) : null}
        </>
      ) : null}
      <Label>{mode === 'solo' ? 'Meta (Puntacos · máx. 10 rondas)' : 'Meta (Puntacos)'}</Label>
      <Input value={targetScore} onChangeText={setTargetScore} placeholder="10" keyboardType="number-pad" maxLength={2} />
      <Label>PACKS DE CARTAS (selecciona)</Label>
      <View style={[styles.packTabs, mobileCompact && styles.packTabsMobile]}>
        <Chip label="Temas Core" selected={allTemasOn} onPress={toggleTemasCore} badge={`${temaIds.filter((id) => selectedSet.has(id)).length}/${temaIds.length}`} />
        <Chip label="Temas +18" selected={allAdultOn} onPress={toggleTemas18} badge={`${adultIds.filter((id) => selectedSet.has(id)).length}/${adultIds.length}`} />
      </View>
      <Muted>
        {selectedDeckCounts.prompts} preguntas · {selectedDeckCounts.answers}{' '}respuestas · {selectedPlayable.length || 1} pack{selectedPlayable.length === 1 ? '' : 's'}
        {bannedCount ? ` · ${bannedCount} banneadas fuera` : ''}
      </Muted>
      <View style={[styles.packGrid, styles.packGridDense, mobileCompact && styles.packGridMobile]}>
        {packs.map((p) => (
          <View key={p.id} style={[styles.packCell, { width: packCellWidthPct }]}>
            <PackTile
              compact
              title={shortPackTitle(p.id, p.title)}
              group={ADULT_IDS.has(p.id) ? '+18' : 'Core'}
              nsfw={p.nsfw || ADULT_IDS.has(p.id)}
              subtitle={mobileCompact ? `${(p.counts.answers ?? 0) + (p.counts.prompts ?? 0)}` : `${p.counts.prompts ?? 0}p · ${p.counts.answers ?? 0}r`}
              selected={selectedSet.has(p.id)}
              onPress={() => togglePack(p.id)}
            />
          </View>
        ))}
      </View>
      <Button title={mode === 'async' ? 'Crear partida Multijugador' : 'Jugar solo (rivales aleatorios)'} onPress={onCreate} />
      <Button title="★ Respuestas favoritas" variant="outline" onPress={() => router.push('/historial')} />
      {ready && recent.length > 0 ? (
        <>
          <Label>Partidas recientes</Label>
          {recent.map((g) => (
            <Button key={g.code} title={`${g.code} · ${g.mode} · ${g.phase} · ${g.players.length} jug.`} variant="ghost" onPress={() => openGame(g.code, g.phase)} />
          ))}
        </>
      ) : null}
      <Muted>
        {mode === 'async'
          ? 'Multijugador: online con KV en Vercel · o local pass-and-play.'
          : 'Modo Solo local · sin cuenta ni servidor.'}{' '}Cartas banneadas nunca se reparte.
      </Muted>
    </Screen>
  );
}

function useHomeStyles() {
  const { colors, fontFamily, themeId } = useTheme();
  const classic = themeId === 'classic';
  return useMemo(
    () =>
      StyleSheet.create({
        screenDense: {},
        brandTop: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 4 },
        brandRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
        brandTitle: { color: classic ? '#111111' : colors.accent, fontWeight: '900', letterSpacing: 2, fontSize: 28, textTransform: 'uppercase', flexShrink: 1 },
        brandVersion: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
        brandTitleDense: { fontSize: 24, letterSpacing: 1.5 },
        subDense: { fontSize: 13, lineHeight: 18 },
        localNotice: { marginTop: -4, marginBottom: 4, fontSize: 12, lineHeight: 16 },
        row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        modeRow: { gap: 6 },
        modeRowMobile: { gap: 4 },
        wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        packTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        packTabsMobile: { gap: 4 },
        packGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' },
        packGridDense: { gap: 6 },
        packGridMobile: { gap: 4 },
        packCell: { width: '23%' },
      }),
    [colors, fontFamily, classic]
  );
}
