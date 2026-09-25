import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

const HIT: Record<string, { bg: string; fg: string }> = {
  guerrilla: { bg: '#FFC857', fg: '#1A0A00' },
  classic: { bg: '#111111', fg: '#FFFFFF' },
  oscuro: { bg: '#5CFF9E', fg: '#04140A' },
};

export function WinFlash({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const { themeId } = useTheme();
  const hit = HIT[themeId] || HIT.guerrilla;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.18,
          duration: 55,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 55,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 10 }
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  if (!active) return <View>{children}</View>;
  return (
    <Animated.View
      style={[styles.hit, { opacity: pulse, backgroundColor: hit.bg }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hit: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
