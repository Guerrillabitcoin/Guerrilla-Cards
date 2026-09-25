import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../store/ThemeContext';

export function LobbyShareCard({
  code,
  onCopy,
}: {
  code: string;
  onCopy: () => void;
}) {
  const { colors, fontFamily } = useTheme();
  return (
    <Pressable
      onPress={onCopy}
      style={[
        {
          backgroundColor: colors.zar || '#6A1B9A',
          borderColor: colors.accent,
          borderWidth: 3,
          borderRadius: 8,
          paddingVertical: 16,
          paddingHorizontal: 14,
          gap: 4,
          marginBottom: 10,
        },
      ]}
    >
      <Text style={{ color: '#FFE082', fontFamily, fontWeight: '900', fontSize: 11, letterSpacing: 1.4 }}>
        1. COMPARTE ESTO PRIMERO
      </Text>
      <Text style={{ color: '#FFFFFF', fontFamily, fontWeight: '900', fontSize: 22 }}>
        Copiar enlace lobby
      </Text>
      <Text style={{ color: '#FFF8E1', fontFamily, fontWeight: '900', fontSize: 28, letterSpacing: 3 }}>
        {code}
      </Text>
      <Text style={{ color: '#E1BEE7', fontFamily, fontWeight: '700', fontSize: 13, marginTop: 2 }}>
        Quien abra el enlace entra como jugador nuevo
      </Text>
    </Pressable>
  );
}
