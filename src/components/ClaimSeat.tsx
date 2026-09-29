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

/** Seat recovery deep-link. recover=1 → force sync + orange banner on /play. */
export function recoveryUrl(
  code: string,
  seat?: string | null,
  opts?: { recover?: boolean }
): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const codeQ = encodeURIComponent(code.trim().toUpperCase());
  if (seat) {
    const recover =
      opts?.recover === false ? '' : '&recover=1';
    return `${origin}/play?code=${codeQ}&seat=${encodeURIComponent(seat)}${recover}`;
  }
  return `${origin}/lobby?code=${codeQ}`;
}

export async function copyRecoveryUrl(
  code: string,
  seat?: string | null,
  opts?: { recover?: boolean }
): Promise<string> {
  const url = recoveryUrl(code, seat, opts);
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

/**
 * Seat links menu.
 * - Host (in-match): copy each human's recovery link (no lobby link).
 * - Non-host: only their own seat recovery link.
 * - Lobby host may pass showLobbyLink.
 */
export function HostRecoveryLinks({
  code,
  players,
  compact,
  showLobbyLink = false,
  selfId,
}: {
  code: string;
  players: { id: string; nickname: string; isBot?: boolean }[];
  compact?: boolean;
  /** Lobby share only — hide once the match has started. */
  showLobbyLink?: boolean;
  /** If set, only show this player's link (guest menu). */
  selfId?: string | null;
}) {
  const humans = players.filter((p) => !p.isBot);
  const list = selfId
    ? humans.filter((p) => p.id === selfId)
    : humans;
  if (!list.length && !showLobbyLink) return null;
  const guest = !!selfId;
  return (
    <View style={[styles.box, compact ? styles.compact : null]}>
      <Label>{guest ? 'Tu enlace de asiento' : 'Recuperar asiento'}</Label>
      <Muted>
        {guest
          ? 'Guárdalo por si pierdes las cookies o cambias de dispositivo. Abre el enlace para reengancharte (solo entonces verás el aviso naranja).'
          : 'Enlace por jugador si alguien pierde cookies o la partida se atasca. El aviso de desatascar solo aparece al abrir este enlace.'}
      </Muted>
      {showLobbyLink ? (
        <Button
          title={`Copiar enlace lobby (${code})`}
          variant="outline"
          onPress={() => {
            void copyRecoveryUrl(code).then((url) => notify('Lobby', url));
          }}
        />
      ) : null}
      {list.map((p) => (
        <Button
          key={`rec-${p.id}`}
          title={guest ? 'Copiar mi enlace' : `Copiar ${p.nickname}`}
          variant={guest ? 'outline' : 'ghost'}
          onPress={() => {
            void copyRecoveryUrl(code, p.id).then((url) =>
              notify(guest ? 'Tu asiento' : p.nickname, url)
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
