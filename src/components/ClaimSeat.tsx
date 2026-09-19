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
  const u = `${origin}/?code=${encodeURIComponent(code.trim().toUpperCase())}`;
  return seat ? `${u}&seat=${encodeURIComponent(seat)}` : u;
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

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderColor: '#F9A825',
    borderRadius: 4,
    padding: 10,
    gap: 8,
    marginVertical: 8,
  },
});
