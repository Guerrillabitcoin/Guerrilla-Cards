import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Button, Input, Label, Muted, Screen, Title } from '@/src/components/ui';
import { colors } from '@/src/theme/colors';
import { APP_VERSION, APP_VERSION_LABEL } from '@/src/version';

export default function ReportScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 3) {
      Alert.alert('Report', 'Escribe al menos unas palabras sobre el fallo.');
      return;
    }
    setSending(true);
    try {
      const origin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : '';
      if (origin) {
        await fetch(`${origin}/api/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            v: APP_VERSION,
            ts: Date.now(),
            message: text,
            context: 'user_report',
            path: typeof window !== 'undefined' ? window.location.pathname : '',
            ua: typeof navigator !== 'undefined' ? navigator.userAgent : Platform.OS,
          }),
          keepalive: true,
        });
      }
      setSent(true);
      setMessage('');
    } catch {
      Alert.alert(
        'Sin conexión',
        'No se pudo enviar ahora. Prueba de nuevo cuando tengas red.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <Title>Reportar fallo</Title>
      <Muted>
        Cuéntanos qué falló ({APP_VERSION_LABEL}). Se envía anónimo a los logs
        del proyecto; no pedimos email.
      </Muted>
      <Label>Qué pasó</Label>
      <Input
        value={message}
        onChangeText={setMessage}
        placeholder="Ej: en la ronda 3 la mano se quedó en 10 cartas…"
        multiline
        style={styles.area}
      />
      {sent ? (
        <Muted style={styles.ok}>Gracias — report recibido.</Muted>
      ) : null}
      <View style={styles.row}>
        <Button
          title={sending ? 'Enviando…' : 'Enviar report'}
          onPress={submit}
          disabled={sending}
        />
        <Button title="Volver" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  area: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  row: { gap: 8, marginTop: 8 },
  ok: { color: colors.accent, fontWeight: '700' },
});
