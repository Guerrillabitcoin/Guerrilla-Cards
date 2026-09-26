import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

export function LobbyShareCard({
  code,
  seated,
  cap,
  onCopy,
}: {
  code: string;
  seated?: number;
  cap?: number;
  onCopy: () => void;
}) {
  const { colors, fontFamily } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable
        onPress={onCopy}
        style={[styles.box, { backgroundColor: colors.zar || '#4A148C', borderColor: colors.accent }]}
      >
        <View style={styles.row}>
          <View style={styles.badge}>
            <Text style={styles.silhouette}>👤</Text>
            <View style={styles.plus}>
              <Text style={styles.plusTxt}>+1</Text>
            </View>
          </View>
          <View style={styles.texts}>
            <Text style={[styles.kicker, { fontFamily }]}>Invitar · sumar gente</Text>
            <Text style={[styles.title, { fontFamily }]}>Lobby {code}</Text>
            <Text style={[styles.hint, { fontFamily }]}>
              Toca para copiar el enlace
              {seated != null && cap != null ? ` · ${seated}/${cap}` : ''}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 3,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#311B92',
    borderWidth: 2,
    borderColor: '#FFE082',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: { fontSize: 26 },
  plus: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#00C853',
    borderRadius: 10,
    minWidth: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  plusTxt: { color: '#FFF', fontWeight: '900', fontSize: 11 },
  texts: { flex: 1 },
  kicker: {
    color: '#FFE082',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: '#FFFFFF', fontWeight: '900', fontSize: 26, letterSpacing: 1 },
  hint: { color: '#E1BEE7', fontWeight: '700', fontSize: 13, marginTop: 2 },
});
