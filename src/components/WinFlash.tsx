import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

const ROUND: Record<string, string> = {
  guerrilla: '#E06A1A',
  classic: '#C45A12',
  oscuro: '#123D28',
};
const MATCH: Record<string, string> = {
  guerrilla: '#FF6D00',
  classic: '#E65100',
  oscuro: '#0D3A4A',
};

export function WinFlash({
  active,
  variant = 'round',
  children,
}: {
  active: boolean;
  variant?: 'round' | 'match';
  children: React.ReactNode;
}) {
  const { themeId } = useTheme();
  const bg = (variant === 'match' ? MATCH : ROUND)[themeId] || ROUND.guerrilla;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  if (!active) return <View>{children}</View>;
  return (
    <Animated.View style={[styles.hit, { opacity: pulse, backgroundColor: bg }]}>
      {children}
    </Animated.View>
  );
}

export function WinnerScreenFlash({
  active,
  variant = 'round',
}: {
  active: boolean;
  variant?: 'round' | 'match';
}) {
  const { themeId } = useTheme();
  const bg = (variant === 'match' ? MATCH : ROUND)[themeId] || ROUND.guerrilla;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
      ]),
      { iterations: variant === 'match' ? 6 : 3 }
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse, variant]);
  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: pulse, zIndex: 40 }]}
    />
  );
}

const styles = StyleSheet.create({
  hit: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
});
