import { StyleSheet, View } from 'react-native';
import { Button, Label, Muted } from './ui';
import type { GameState } from '../engine/types';

export function ClaimSeat({
  game,
  onPick,
}: {
  game: GameState;
  onPick: (playerId: string) => void;
}) {
  const humans = game.players.filter((p) => !p.isBot);
  return (
    <View style={styles.box}>
      <Label>¿Quién eres?</Label>
      <Muted>
        Este dispositivo no tiene asiento. Elige tu jugador para recuperar
        mano y turno. Código {game.code} · ronda {game.round} · {game.phase}
      </Muted>
      {humans.map((p) => (
        <Button
          key={p.id}
          title={`${p.nickname} · ${p.score} pts${p.isHost ? ' · anfitrión' : ''}`}
          onPress={() => onPick(p.id)}
        />
      ))}
    </View>
  );
}

export function recoveryUrl(code: string, seat?: string | null): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const codeQ = encodeURIComponent(code.trim().toUpperCase());
  // Deep-link into the live board (not home). Seat claim runs on /play.
  if (seat) {
    return `${origin}/play?code=${codeQ}&seat=${encodeURIComponent(seat)}`;
  }
  return `${origin}/lobby?code=${codeQ}`;
}

export async function copyRecoveryUrl(
  code: string,
  seat?: string | null
): Promise<string> {
  const url = recoveryUrl(code, seat);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    /* ignore */
  }
  return url;
}

function notify(title: string, url: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${url}`);
  }
}

/** Host-only: copy per-player recovery links (lost cookies / new device). */
export function HostRecoveryLinks({
  code,
  players,
  compact,
}: {
  code: string;
  players: { id: string; nickname: string; isBot?: boolean }[];
  compact?: boolean;
}) {
  const humans = players.filter((p) => !p.isBot);
  if (!humans.length) return null;
  return (
    <View style={[styles.box, compact ? styles.compact : null]}>
      <Label>Recuperar asiento</Label>
      <Muted>Al final · solo anfitrión · si alguien pierde las cookies</Muted>
      <Button
        title={`Copiar enlace lobby (${code})`}
        variant="outline"
        onPress={() => {
          void copyRecoveryUrl(code).then((url) => notify('Lobby', url));
        }}
      />
      {humans.map((p) => (
        <Button
          key={`rec-${p.id}`}
          title={`Copiar ${p.nickname}`}
          variant="ghost"
          onPress={() => {
            void copyRecoveryUrl(code, p.id).then((url) =>
              notify(p.nickname, url)
            );
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderColor: '#F9A825',
    borderRadius: 4,
    padding: 10,
    gap: 8,
    marginVertical: 8,
  },
  compact: {
    marginTop: 24,
    marginBottom: 8,
    opacity: 0.95,
  },
});
