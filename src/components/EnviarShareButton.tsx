import { Pressable, StyleSheet, Text } from 'react-native';
import { TelegramPlane } from './TelegramPlane';

type Size = 'sm' | 'md';

/** Compact Telegram-blue “enviar” control (paper plane + label). */
export function EnviarShareButton({
  onPress,
  size = 'md',
}: {
  onPress: () => void;
  /** sm = favoritas; md = results */
  size?: Size;
}) {
  const box = size === 'sm' ? 32 : 40;
  // Plane fills most of the square
  const plane = size === 'sm' ? 18 : 24;
  const labelSize = size === 'sm' ? 7 : 8;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.box, { width: box, height: box, gap: size === 'sm' ? 0 : 1 }]}
      accessibilityLabel="Enviar"
      hitSlop={6}
    >
      <TelegramPlane size={plane} />
      <Text style={[styles.label, { fontSize: labelSize, lineHeight: labelSize + 1 }]}>
        enviar
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 4,
    backgroundColor: '#2AABEE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 1,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
