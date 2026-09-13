import { guerrillaTheme, type ThemeColors } from './themes';

/**
 * @deprecated Prefer useTheme().colors — kept as Guerrilla defaults for
 * module-level StyleSheets that haven't migrated yet.
 */
export const colors: ThemeColors = guerrillaTheme.colors;

export const guerrillaDark = {
  dark: true,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

/** Squarer corners — keep low; avoid pill shapes. */
export const radii = {
  xs: 2,
  sm: 3,
  md: 4,
  lg: 4,
  chip: 4,
};
