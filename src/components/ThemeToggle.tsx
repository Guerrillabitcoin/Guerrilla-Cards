import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';
import { THEME_ORDER, THEMES } from '../theme/themes';

/** Compact top control to cycle Classic / Guerrilla / Oscuro. */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { themeId, colors, fontFamily, setThemeId, cycleTheme } = useTheme();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={cycleTheme}
        accessibilityLabel={`Tema ${THEMES[themeId].label}. Tocar para cambiar.`}
        hitSlop={8}
        style={[
          styles.btn,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
          },
          compact && styles.btnCompact,
        ]}
      >
        <Text
          style={[
            styles.btnText,
            { color: colors.text, fontFamily },
            compact && styles.btnTextCompact,
          ]}
        >
          ◐ {THEMES[themeId].label}
        </Text>
      </Pressable>
      {!compact ? (
        <View style={styles.dots}>
          {THEME_ORDER.map((id) => (
            <Pressable
              key={id}
              onPress={() => setThemeId(id)}
              hitSlop={6}
              accessibilityLabel={THEMES[id].label}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    id === themeId ? colors.accent : colors.border,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  btnTextCompact: {
    fontSize: 11,
  },
  dots: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
