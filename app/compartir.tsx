import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  const { width: winW } = useWindowDimensions();
  /** Preview mirrors export size; capture forced to 420×420. */
  const shareSide = Math.min(420, Math.max(260, winW - 48));
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
          width: 420,
          height: 420,
        }}
        style={[styles.shotWrap, { width: shareSide, height: shareSide }]}
      >
        <View style={[styles.card, { width: shareSide, height: shareSide }]}>
          <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit>
            GUERRILLA CARDS
          </Text>
          <Text style={styles.tag}>
            Humor negro y absurdo en español. Juega en guerrillacards.vercel.app
          </Text>
          <View style={styles.promptBox}>
            {promptText && answers.length ? (
              <FilledPromptText
                large
                promptText={promptText}
                answers={answers}
              />
            ) : (
              <Text
                style={styles.filledFallback}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {filledText}
              </Text>
            )}
          </View>
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
    alignSelf: 'center',
    marginVertical: 12,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.md,
    padding: 16,
    gap: 10,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  brand: {
    color: colors.accent,
    fontFamily,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    flexShrink: 0,
  },
  tag: {
    color: colors.textMuted,
    fontFamily,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: -2,
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  promptBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filledFallback: {
    color: colors.text,
    fontFamily,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
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

