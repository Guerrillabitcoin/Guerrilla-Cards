import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export function WinFlash({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.2,
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
    <Animated.View style={[styles.hit, { opacity: pulse }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hit: {
    backgroundColor: '#00E676',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
