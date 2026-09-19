import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const SECONDS = 8;

export function NextRoundBar({
  active,
  onDone,
}: {
  active: boolean;
  onDone?: () => void;
}) {
  const [left, setLeft] = useState(SECONDS);

  useEffect(() => {
    if (!active) {
      setLeft(SECONDS);
      return;
    }
    setLeft(SECONDS);
    const id = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(id);
          onDone?.();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <View style={styles.box}>
      <Text style={styles.text}>Siguiente ronda {left}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#1B5E20',
    borderWidth: 2,
    borderColor: '#66BB6A',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 6,
  },
  text: {
    color: '#C8E6C9',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
