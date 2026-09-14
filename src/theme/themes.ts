import { Platform } from 'react-native';

export type ThemeId = 'guerrilla' | 'classic' | 'oscuro';

export type ThemeColors = {
  bg: string;
  bgElevated: string;
  bgCard: string;
  border: string;
  accent: string;
  accentDim: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  textDim: string;
  success: string;
  warning: string;
  promptBg: string;
  promptText: string;
  answerBg: string;
  answerText: string;
  zar: string;
};

export type AppTheme = {
  id: ThemeId;
  label: string;
  colors: ThemeColors;
  /** Base UI/card font stack. */
  fontFamily: string;
};

const verdana = Platform.select({
  web: 'Verdana, Geneva, Tahoma, sans-serif',
  default: 'Verdana',
}) as string;

const system = Platform.select({
  web: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) as string;

/** Current Guerrilla look — default. */
export const guerrillaTheme: AppTheme = {
  id: 'guerrilla',
  label: 'Guerrilla',
  fontFamily: system,
  colors: {
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
  },
};

/**
 * Classic CAH-inspired B/W.
 * Answers: black bg + white text (as requested).
 * Prompts: white bg + black text so they stay distinct.
 * All Verdana.
 */
export const classicTheme: AppTheme = {
  id: 'classic',
  label: 'Classic',
  fontFamily: verdana,
  colors: {
    bg: '#F2F2F2',
    bgElevated: '#FFFFFF',
    bgCard: '#FFFFFF',
    border: '#111111',
    // Resaltes home (packs/opciones): naranja oscuro + texto claro
    accent: '#C45A12',
    accentDim: '#8C3F0C',
    accentSoft: '#E07A30',
    text: '#111111',
    textMuted: '#333333',
    textDim: '#666666',
    success: '#1B1B1B',
    warning: '#444444',
    promptBg: '#FFFFFF',
    promptText: '#111111',
    answerBg: '#111111',
    answerText: '#FFFFFF',
    zar: '#111111',
  },
};

/** Dark mode — deep neutrals, soft accent. */
export const oscuroTheme: AppTheme = {
  id: 'oscuro',
  label: 'Oscuro',
  fontFamily: system,
  colors: {
    bg: '#0B0B0E',
    bgElevated: '#15151A',
    bgCard: '#1C1C24',
    border: '#2E2E3A',
    accent: '#D4844A',
    accentDim: '#6E3A1C',
    accentSoft: '#E0A574',
    text: '#ECEAF0',
    textMuted: '#A9A5B3',
    textDim: '#6F6B7A',
    success: '#3D9B6A',
    warning: '#C9A227',
    promptBg: '#1A1A24',
    promptText: '#ECEAF0',
    answerBg: '#8A4A22',
    answerText: '#FFF6EE',
    zar: '#D4B45A',
  },
};

export const THEMES: Record<ThemeId, AppTheme> = {
  guerrilla: guerrillaTheme,
  classic: classicTheme,
  oscuro: oscuroTheme,
};

export const THEME_ORDER: ThemeId[] = ['guerrilla', 'classic', 'oscuro'];

export const DEFAULT_THEME_ID: ThemeId = 'guerrilla';
