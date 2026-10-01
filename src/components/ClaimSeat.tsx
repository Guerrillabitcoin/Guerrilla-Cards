import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Label, Muted } from './ui';
import { useTheme } from '../store/ThemeContext';
import type { GameState } from '../engine/types';
import { fetchSeatTokens, getMySeatSync, getSeatToken } from '../store/roomSync';

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
    const tok = getSeatToken(code, seat);
    const t = tok ? `&t=${encodeURIComponent(tok)}` : '';
    return `${origin}/play?code=${codeQ}&seat=${encodeURIComponent(seat)}${t}${recover}`;
  }
  return `${origin}/lobby?code=${codeQ}`;
}

export async function copyRecoveryUrl(
  code: string,
  seat?: string | null,
  opts?: { recover?: boolean }
): Promise<string> {
  if (seat && !getSeatToken(code, seat)) {
    // Host: fetch every seat token once (server checks host token).
    const me = getMySeatSync(code);
    if (me) await fetchSeatTokens(code, me);
  }
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

const HELP =
  'Guarda este enlace o pídeselo al anfitrión para recuperar tu asiento en una partida (cambio de dispositivo, ronda atascada y como solución para bugs).';

/**
 * Collapsible seat-links menu (default closed).
 * Host: all humans. Guest (selfId): only own seat. No lobby link in-match.
 */
export function HostRecoveryLinks({
  code,
  players,
  compact,
  showLobbyLink = false,
  selfId,
  defaultOpen = false,
}: {
  code: string;
  players: { id: string; nickname: string; isBot?: boolean }[];
  compact?: boolean;
  showLobbyLink?: boolean;
  selfId?: string | null;
  defaultOpen?: boolean;
}) {
  const { colors, fontFamily } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const humans = players.filter((p) => !p.isBot);
  const list = selfId ? humans.filter((p) => p.id === selfId) : humans;
  if (!list.length && !showLobbyLink) return null;
  const guest = !!selfId;
  const title = guest ? 'Tu enlace de asiento' : 'Enlaces de asiento';

  return (
    <View
      style={[
        styles.box,
        compact ? styles.compact : null,
        { borderColor: colors.warning, backgroundColor: colors.bgElevated },
      ]}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.head}
        accessibilityRole="button"
      >
        <Text style={[styles.headTitle, { color: colors.text, fontFamily }]}>
          {title} {open ? '▴' : '▾'}
        </Text>
      </Pressable>
      {open ? (
        <>
          <Text style={[styles.help, { color: colors.text, fontFamily }]}>
            {HELP}
          </Text>
          {showLobbyLink ? (
            <Button
              title={`Copiar enlace sala (${code})`}
              variant="outline"
              onPress={() => {
                void copyRecoveryUrl(code).then((url) => notify('Sala', url));
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
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
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
  head: { paddingVertical: 2 },
  headTitle: { fontWeight: '800', fontSize: 15 },
  help: { fontSize: 13, fontWeight: '600', lineHeight: 18, opacity: 0.92 },
});
