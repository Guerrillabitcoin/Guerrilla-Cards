import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_THEME_ID,
  THEME_ORDER,
  THEMES,
  type AppTheme,
  type ThemeColors,
  type ThemeId,
} from '../theme/themes';

const THEME_KEY = 'guerrilla_theme_v1';

type ThemeContextValue = {
  themeId: ThemeId;
  theme: AppTheme;
  colors: ThemeColors;
  fontFamily: string;
  setThemeId: (id: ThemeId) => void;
  cycleTheme: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_KEY);
        if (!cancelled && raw && raw in THEMES) {
          setThemeIdState(raw as ThemeId);
        }
      } catch {
        /* keep default */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    void AsyncStorage.setItem(THEME_KEY, id);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeIdState((cur) => {
      const i = THEME_ORDER.indexOf(cur);
      const next = THEME_ORDER[(i + 1) % THEME_ORDER.length];
      void AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const theme = THEMES[themeId];

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme,
      colors: theme.colors,
      fontFamily: theme.fontFamily,
      setThemeId,
      cycleTheme,
      ready,
    }),
    [themeId, theme, setThemeId, cycleTheme, ready]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback before provider (shouldn't happen in app)
    const theme = THEMES[DEFAULT_THEME_ID];
    return {
      themeId: DEFAULT_THEME_ID,
      theme,
      colors: theme.colors,
      fontFamily: theme.fontFamily,
      setThemeId: () => {},
      cycleTheme: () => {},
      ready: false,
    };
  }
  return ctx;
}
