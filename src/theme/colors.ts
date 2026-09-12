export const colors = {
  bg: '#14081F',
  bgElevated: '#221033',
  bgCard: '#2C1742',
  border: '#4A2F6A',
  accent: '#E06A1A',
  accentDim: '#8C3F0C',
  accentSoft: '#F08A3A',
  text: '#F7F2FF',
  textMuted: '#C4B3D9',
  textDim: '#8E7AA8',
  success: '#2ECC71',
  warning: '#F1C40F',
  promptBg: '#3B1A5C',
  promptText: '#F7F2FF',
  answerBg: '#B84F0E',
  answerText: '#FFF8F0',
  zar: '#FFC857',
};

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
  /** Chips/buttons: square-ish, not capsules */
  chip: 4,
};

