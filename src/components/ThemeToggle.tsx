import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';
import { THEME_ORDER, THEMES, type ThemeId } from '../theme/themes';

const FRAME: Record<ThemeId, { bg: string; border: string; text: string }> = {
  guerrilla: { bg: '#2C1742', border: '#6B3FA0', text: '#F7F2FF' },
  classic: { bg: '#FFFFFF', border: '#C45A12', text: '#111111' },
  oscuro: { bg: '#1C1C24', border: '#8A8A99', text: '#ECEAF0' },
};

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { themeId, colors, fontFamily, setThemeId, cycleTheme } = useTheme();

  if (compact) {
    return (
      <Pressable
        onPress={cycleTheme}
        accessibilityLabel={`Tema ${THEMES[themeId].label}. Tocar para cambiar.`}
        hitSlop={8}
        style={[
          styles.compact,
          { backgroundColor: colors.bgElevated, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.compactText, { color: colors.text, fontFamily }]}>
          ◐ {THEMES[themeId].label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      {THEME_ORDER.map((id) => {
        const frame = FRAME[id];
        const on = id === themeId;
        return (
          <Pressable
            key={id}
            onPress={() => setThemeId(id)}
            accessibilityLabel={THEMES[id].label}
            style={[
              styles.card,
              {
                backgroundColor: frame.bg,
                borderColor: frame.border,
                borderWidth: on ? 3 : 2,
                opacity: on ? 1 : 0.72,
              },
            ]}
          >
            <Text style={[styles.cardText, { color: frame.text }]}>
              {THEMES[id].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  card: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  cardText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  compact: {
    borderWidth: 2,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  compactText: { fontSize: 11, fontWeight: '800' },
});
