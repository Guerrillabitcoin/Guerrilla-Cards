import { Button, Muted } from './ui';

export function LobbyJoinBar({
  onJoin,
  busy,
}: {
  onJoin: () => void;
  busy?: boolean;
}) {
  return (
    <>
      <Button
        title={busy ? 'Entrando…' : 'Unirme a esta mesa (este móvil)'}
        onPress={onJoin}
      />
      <Muted>
        Cada dispositivo es un jugador. Si no sale “tú” en la lista, pulsa
        Unirme.
      </Muted>
    </>
  );
}
