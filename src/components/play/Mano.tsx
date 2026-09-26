import React from 'react';
import { View } from 'react-native';
import type { Card } from '../../engine/types';
import { CardFace } from '../ui';

function ManoInner({
  cards,
  selectedIds,
  onToggle,
  disabled,
}: {
  cards: Card[];
  selectedIds: string[];
  onToggle: (card: Card) => void;
  disabled?: boolean;
}) {
  const picked = new Set(selectedIds);
  return (
    <View>
      {cards.map((c) => (
        <CardFace
          key={c.id}
          type="answer"
          text={c.text}
          selected={picked.has(c.id)}
          onPress={() => {
            if (!disabled) onToggle(c);
          }}
        />
      ))}
    </View>
  );
}

export const Mano = React.memo(ManoInner);
