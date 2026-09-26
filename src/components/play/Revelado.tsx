import React from 'react';
import { Text, View } from 'react-native';
import type { GameState } from '../../engine/types';
import { RoundStandings } from '../RoundStandings';
import { WinFlash } from '../WinFlash';

function ReveladoInner({
  game,
  meId,
  iWon,
  winnerName,
}: {
  game: GameState;
  meId?: string | null;
  iWon: boolean;
  winnerName: string;
}) {
  return (
    <View>
      <WinFlash active={iWon}>
        <Text style={{ fontWeight: '900', fontSize: 22 }}>
          {iWon ? '¡Puntaco!' : `Ganó ${winnerName}`}
        </Text>
      </WinFlash>
      <RoundStandings game={game} meId={meId} />
    </View>
  );
}

export const Revelado = React.memo(ReveladoInner);
