import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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
  DEFAULT_TARGET_SCORE,
  SOLO_DEFAULT_TARGET,
  type GameMode,
} from '@/src/engine/types';
import { useGameStore } from '@/src/store/GameContext';
import { randomNickname } from '@/src/engine/nicknames';
import { colors } from '@/src/theme/colors';
import { APP_VERSION } from '@/src/version';


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

  const router = useRouter();
  const { createGame, createAndStartSolo, joinOrOpen, games, ready } =
    useGameStore();
  const packs = useMemo(
    () => getPlayablePackMeta().filter((p) => p.id !== '_banned'),
    []
  );
  const { width: winW } = useWindowDimensions();
  const denseMenu = winW >= 900;
  const mobileCompact = winW < 700;
  // Muy compacto: más columnas = tiles más pequeños
  // More columns → smaller pack boxes
  const packCols = mobileCompact
    ? 4
    : winW >= 1400
      ? 7
      : winW >= 1100
        ? 6
        : winW >= 900
          ? 6
          : 5;
  const packCellWidthPct =
    `${(100 - (packCols - 1) * (mobileCompact ? 2 : 1.2)) / packCols}%` as `${number}%`;
  const ADULT_IDS = useMemo(
    () => new Set(['plus18', 'sexo', 'drogas', 'religion']),
    []
  );
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
  const [mode, setMode] = useState<GameMode>('solo');
  // Multi / async paused — always Solo for now
  // Por defecto: todas las de Temas Core (nada de +18, nunca banneadas)
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
        {
          text: 'Soy mayor de 18',
          onPress: () => {
            markAdultOk();
            onYes();
          },
        },
      ]);
    },
    [adultOk, markAdultOk]
  );

  const selectedPlayable = useMemo(
    () => selected.filter((id) => id !== '_banned'),
    [selected]
  );
  const selectedSet = useMemo(() => new Set(selectedPlayable), [selectedPlayable]);
  const selectedKey = useMemo(
    () => selectedPlayable.slice().sort().join('|'),
    [selectedPlayable]
  );
  const selectedDeckCounts = useMemo(() => {
    const c = countCombinedDeck(selectedPlayable.length ? selectedPlayable : ['core']);
    return {
      prompts: c.prompts,
      answers: c.answers,
      packs: selectedPlayable.length || 1,
    };
  }, [selectedKey, selectedPlayable]);
  const bannedCount = useMemo(() => getBannedCount(), []);
  const allTemasOn =
    temaIds.length > 0 && temaIds.every((id) => selectedSet.has(id));
  const allAdultOn =
    adultIds.length > 0 && adultIds.every((id) => selectedSet.has(id));

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
        // Desmarcar Temas Core: quita el resto de temas, pero deja `core`.
        // Para quitar `core` hay que pulsar el tile Core a mano.
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
    // Turning all +18 off never needs confirm
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
    if (phase === 'lobby') {
      router.push({ pathname: '/lobby', params: { code } });
    } else if (phase === 'results') {
      router.push({ pathname: '/results', params: { code } });
    } else {
      router.push({ pathname: '/play', params: { code } });
    }
  };

  const startSoloNow = () => {
    try {
      if (!ready) {
        Alert.alert('Un momento', 'Cargando mazo y partidas guardadas…');
        return;
      }
      if (!nickname.trim()) {
        Alert.alert('Apodo', 'Escribe un apodo para el anfitrión.');
        return;
      }
      const target = parseTarget();
      const game = createAndStartSolo({
        hostNickname: nickname.trim(),
        packIds: selectedPlayable,
        targetScore: target,
      });
      openGame(game.code, game.phase);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo crear');
    }
  };

  const onCreate = () => {
    setMode('solo');
    const needsAdult = selectedPlayable.some((id) => ADULT_IDS.has(id));
    if (needsAdult && !adultOk) {
      confirmAdult(() => startSoloNow());
      return;
    }
    startSoloNow();
  };

  const onJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Código', 'Introduce el código de la partida.');
      return;
    }
    const game = joinOrOpen(code);
    if (!game) {
      Alert.alert(
        'No encontrada',
        'En este MVP las partidas viven solo en este dispositivo. Crea una partida o usa un código guardado aquí.'
      );
      return;
    }
    openGame(game.code, game.phase);
  };

  const recent = Object.values(games)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  const modeHint =
    mode === 'live'
      ? 'En vivo = rondas rápidas pass-and-play.'
      : mode === 'async'
        ? 'Async = misma lógica pero la partida se guarda en el teléfono para retomar después.'
        : 'Solo = tú respondes cada ronda y juzgas. Los rivales se rellenan al azar del mazo (sin asientos bot).';

  return (
    <Screen style={denseMenu ? styles.screenDense : undefined} contentDense={denseMenu}>
      <View style={styles.brandRow}>
        <Text
          style={[styles.brandTitle, denseMenu && styles.brandTitleDense]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          GUERRILLA CARDS
        </Text>
        <Text style={styles.brandVersion}>{APP_VERSION}</Text>
      </View>
      <Subtitle style={denseMenu ? styles.subDense : undefined}>
        Juego de humor negro en español. Rellena los huecos de las preguntas con
        disparatadas e ingeniosas respuestas.
      </Subtitle>
      <Muted style={styles.localNotice}>
        {Platform.OS === 'web'
          ? 'Las partidas se guardan solo en este navegador. Si borras datos del sitio o cambias de dispositivo, se pierden.'
          : 'Las partidas se guardan solo en este dispositivo. Si borras los datos de la app, se pierden.'}
      </Muted>

      <Label>Tu apodo (aleatorio al entrar)</Label>
      <Input
        value={nickname}
        onChangeText={setNickname}
        placeholder="ComidaADomicilio"
        autoCapitalize="none"
        maxLength={42}
      />
      <Button
        title="Otro nombre raro"
        variant="ghost"
        onPress={() => setNickname(randomNickname(nickname))}
      />

      <Label>Modo</Label>
      <View style={[styles.row, styles.modeRow, mobileCompact && styles.modeRowMobile]}>
        <Chip
          label={mobileCompact ? 'Solo' : 'Solo (rivales)'}
          selected={mode === 'solo'}
          onPress={() => {
            setMode('solo');
            setTargetScore(String(SOLO_DEFAULT_TARGET));
          }}
        />
        <Chip
          label="En vivo"
          selected={false}
          disabled
          badge="próximamente"
          onPress={() => {}}
        />
        <Chip
          label="Async"
          selected={false}
          disabled
          badge="próximamente"
          onPress={() => {}}
        />
      </View>
      {!mobileCompact ? (
        <Muted>Solo está disponible. En vivo y Async: próximamente.</Muted>
      ) : null}

      <Label>Meta (Puntacos · máx. 10 rondas)</Label>
      <Input
        value={targetScore}
        onChangeText={setTargetScore}
        placeholder="5"
        keyboardType="number-pad"
        maxLength={2}
      />

      <Label>PACKS DE CARTAS (selecciona)</Label>
      <View style={[styles.packTabs, mobileCompact && styles.packTabsMobile]}>
        <Chip
          label="Temas Core"
          selected={allTemasOn}
          onPress={toggleTemasCore}
          badge={`${temaIds.filter((id) => selectedSet.has(id)).length}/${temaIds.length}`}
        />
        <Chip
          label="Temas +18"
          selected={allAdultOn}
          onPress={toggleTemas18}
          badge={`${adultIds.filter((id) => selectedSet.has(id)).length}/${adultIds.length}`}
        />
      </View>
      <Muted>
        {selectedDeckCounts.prompts} preguntas · {selectedDeckCounts.answers}{' '}
        respuestas · {selectedPlayable.length || 1} pack
        {selectedPlayable.length === 1 ? '' : 's'}
        {bannedCount ? ` · ${bannedCount} banneadas fuera` : ''}
      </Muted>
      <View
        style={[
          styles.packGrid,
          styles.packGridDense,
          mobileCompact && styles.packGridMobile,
        ]}
      >
        {packs.map((p) => (
          <View key={p.id} style={[styles.packCell, { width: packCellWidthPct }]}>
            <PackTile
              compact
              title={shortPackTitle(p.id, p.title)}
              group={ADULT_IDS.has(p.id) ? '+18' : 'Core'}
              nsfw={p.nsfw || ADULT_IDS.has(p.id)}
              subtitle={
                mobileCompact
                  ? `${(p.counts.answers ?? 0) + (p.counts.prompts ?? 0)}`
                  : `${p.counts.prompts ?? 0}p · ${p.counts.answers ?? 0}r`
              }
              selected={selectedSet.has(p.id)}
              onPress={() => togglePack(p.id)}
            />
          </View>
        ))}
      </View>

      <Button
        title="Jugar solo (rivales aleatorios)"
        onPress={onCreate}
      />

      <Button
        title="★ Respuestas favoritas"
        variant="outline"
        onPress={() => router.push('/historial')}
      />

      {mode !== 'solo' ? (
        <>
          <Label>Unirse por código (mismo dispositivo)</Label>
          <Input
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="ABC12"
            autoCapitalize="characters"
            maxLength={8}
          />
          <Button title="Abrir partida" onPress={onJoin} variant="outline" />
        </>
      ) : null}

      {ready && recent.length > 0 ? (
        <>
          <Label>Partidas recientes</Label>
          {recent.map((g) => (
            <Button
              key={g.code}
              title={`${g.code} · ${g.mode} · ${g.phase} · ${g.players.length} jug.`}
              variant="ghost"
              onPress={() => openGame(g.code, g.phase)}
            />
          ))}
        </>
      ) : null}

      <Muted>
        Modo Solo local · sin cuenta ni servidor. Cartas banneadas nunca se reparte.
        Packs +18 piden confirmación de edad la primera vez.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenDense: {
    // consumed by Screen via style prop on outer view
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandTitle: {
    color: colors.accent,
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 28,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  brandVersion: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  brandTitleDense: {
    fontSize: 24,
    letterSpacing: 1.5,
  },
  subDense: {
    fontSize: 13,
    lineHeight: 18,
  },
  localNotice: {
    marginTop: -4,
    marginBottom: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeRow: { gap: 6 },
  modeRowMobile: { gap: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  packTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  packTabsMobile: {
    gap: 4,
  },
  packGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  packGridDense: {
    gap: 6,
  },
  packGridMobile: {
    gap: 4,
  },
  packCell: {
    width: '23%',
  },
});
