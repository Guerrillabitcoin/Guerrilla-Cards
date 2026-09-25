import { Text } from 'react-native';
import { Muted } from './ui';
import { useTheme } from '../store/ThemeContext';

const PHASE: Record<string, string> = {
  lobby: 'Lobby',
  submitting: 'Elige respuesta',
  judging: 'El Zar elige',
  reveal: 'Revelar',
  discarding: 'Descarte',
  results: 'Final',
};

export function PlayStatusBar({
  nickname,
  round,
  phase,
}: {
  nickname: string;
  round: number;
  phase: string;
}) {
  const { colors, fontFamily } = useTheme();
  return (
    <Muted>
      <Text style={{ color: colors.text, fontFamily, fontWeight: '800' }}>
        {nickname}
      </Text>
      {'  ·  ronda '}
      {round || 1}
      {'  ·  '}
      {PHASE[phase] || phase}
    </Muted>
  );
}
