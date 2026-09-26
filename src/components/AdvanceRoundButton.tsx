import { useState } from 'react';
import { Button } from './ui';

export function AdvanceRoundButton({
  isSolo,
  isZar,
  onPress,
}: {
  isSolo: boolean;
  isZar: boolean;
  onPress: () => void;
}) {
  const [flash, setFlash] = useState(false);
  const title = isSolo
    ? '→  Siguiente ronda'
    : flash
      ? 'Zar forzó comienzo de turno'
      : isZar
        ? 'Empezar siguiente ronda (eres el Zar)'
        : '→  Siguiente ronda';
  return (
    <Button
      title={title}
      variant="success"
      onPress={() => {
        if (!isSolo && isZar) {
          setFlash(true);
          setTimeout(() => onPress(), 450);
          return;
        }
        onPress();
      }}
    />
  );
}
