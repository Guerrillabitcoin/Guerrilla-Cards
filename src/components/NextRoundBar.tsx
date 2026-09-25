import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const SECONDS = 8;

export function NextRoundBar({
  active,
  deadlineAt,
  onDone,
}: {
  active: boolean;
  deadlineAt?: number | null;
  onDone?: () => void;
}) {
  const fired = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      fired.current = false;
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const end = deadlineAt || 0;
    if (!end) return;
    if (now < end) return;
    if (fired.current) return;
    fired.current = true;
    onDoneRef.current?.();
  }, [active, deadlineAt, now]);

  if (!active) return null;

  const end = deadlineAt || now + SECONDS * 1000;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  const starting = left <= 0;

  return (
    <View style={[styles.box, starting && styles.boxGo]}>
      <Text style={styles.text}>
        {starting ? 'Empezando nueva ronda' : `Siguiente ronda ${left}s`}
      </Text>
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
  boxGo: {
    backgroundColor: '#0D47A1',
    borderColor: '#64B5F6',
  },
  text: {
    color: '#C8E6C9',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
