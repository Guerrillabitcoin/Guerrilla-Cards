import React from 'react';
import { Pressable, View } from 'react-native';
import type { GameState, Submission } from '../../engine/types';
import { FilledPromptText } from '../ui';

function JuicioInner({
  game,
  submissions,
  onPick,
}: {
  game: GameState;
  submissions: Submission[];
  onPick: (playerId: string) => void;
}) {
  const prompt = game.currentPrompt?.text ?? '';
  return (
    <View>
      {submissions.map((s) => (
        <Pressable key={s.playerId} onPress={() => onPick(s.playerId)}>
          <FilledPromptText
            large
            promptText={prompt}
            answers={s.cards.map((c) => c.text)}
          />
        </Pressable>
      ))}
    </View>
  );
}

export const Juicio = React.memo(JuicioInner);
