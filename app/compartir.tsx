import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  Button,
  FilledPromptText,
  Muted,
  Screen,
} from '@/src/components/ui';
import { radii } from '@/src/theme/colors';
import { useTheme } from '@/src/store/ThemeContext';

function parseAnswers(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const s = Array.isArray(raw) ? raw[0] : raw;
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // ignore
  }
  if (s.includes('|||')) {
    return s.split('|||').map((x) => x.trim()).filter(Boolean);
  }
  return s.trim() ? [s] : [];
}

function paramStr(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}

export default function CompartirScreen() {
  const styles = useCompartirStyles();

  const router = useRouter();
  const params = useLocalSearchParams<{
    promptText?: string;
    answers?: string;
    filledText?: string;
  }>();
  const shotRef = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState(false);

  const promptText = useMemo(
    () => paramStr(params.promptText),
    [params.promptText]
  );
  const answers = useMemo(
    () => parseAnswers(params.answers),
    [params.answers]
  );
  const filledText = useMemo(
    () => paramStr(params.filledText),
    [params.filledText]
  );

  const canShare = !!(promptText && answers.length) || !!filledText;

  const captureAndSend = useCallback(async () => {
    if (!canShare || busy) return;
    setBusy(true);
    try {
      const node = shotRef.current;
      if (!node?.capture) {
        throw new Error('No se pudo capturar la tarjeta.');
      }
      const uri = await node.capture();
      if (!uri) throw new Error('Imagen vacía.');

      if (Platform.OS === 'web') {
        const doc = (globalThis as { document?: Document }).document;
        if (doc) {
          const a = doc.createElement('a');
          a.href = uri;
          a.download = 'guerrilla-cards-respuesta.png';
          a.click();
        }
        const nav = (globalThis as { navigator?: Navigator }).navigator;
        if (nav?.share) {
          try {
            const res = await fetch(uri);
            const blob = await res.blob();
            const file = new File([blob], 'guerrilla-cards.png', {
              type: 'image/png',
            });
            const payload = {
              files: [file],
              title: 'Guerrilla Cards',
              text: filledText || 'Mi respuesta en Guerrilla Cards',
            };
            if (!nav.canShare || nav.canShare(payload)) {
              await nav.share(payload);
            }
          } catch {
            // download already done
          }
        }
        return;
      }

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          'Compartir',
          'Compartir no está disponible en este dispositivo.'
        );
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir respuesta · Guerrilla Cards',
        UTI: 'public.png',
      });
    } catch (e) {
      Alert.alert(
        'Compartir',
        e instanceof Error ? e.message : 'No se pudo generar la imagen'
      );
    } finally {
      setBusy(false);
    }
  }, [busy, canShare, filledText]);

  if (!canShare) {
    return (
      <Screen>
        <Muted>No hay respuesta para compartir.</Muted>
        <Button title="Volver" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.screenTitle}>Compartir respuesta</Text>
      <Muted>
        Vista previa. Pulsa Enviar para generar la imagen y abrir redes / compartir.
      </Muted>

      <ViewShot
        ref={shotRef}
        options={{
          format: 'png',
          quality: 1,
          result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
        }}
        style={styles.shotWrap}
      >
        <View style={styles.card}>
          <Text style={styles.brand}>GUERRILLA CARDS</Text>
          <Text style={styles.tag}>Humor negro · español</Text>
          <View style={styles.promptBox}>
            {promptText && answers.length ? (
              <FilledPromptText
                large
                promptText={promptText}
                answers={answers}
              />
            ) : (
              <Text style={styles.filledFallback}>{filledText}</Text>
            )}
          </View>
          <Text style={styles.footer}>guerrillacards</Text>
        </View>
      </ViewShot>

      <Button
        title={busy ? 'Generando…' : 'Enviar'}
        onPress={() => void captureAndSend()}
        disabled={busy}
      />
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function useCompartirStyles() {
  const { colors, fontFamily } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
  screenTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  shotWrap: {
    alignSelf: 'stretch',
    marginVertical: 12,
  },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.md,
    padding: 20,
    gap: 12,
    minHeight: 220,
  },
  brand: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  tag: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: -6,
  },
  promptBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
  },
  filledFallback: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  footer: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
}),
    [colors, fontFamily]
  );
}

