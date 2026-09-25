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

function isThemeId(v: unknown): v is ThemeId {
  return v === 'guerrilla' || v === 'classic' || v === 'oscuro';
}

function readThemeIdSync(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  try {
    const fromDom = document.documentElement?.dataset?.theme;
    if (isThemeId(fromDom)) return fromDom;
    const keys = [THEME_KEY, `@${THEME_KEY}`, `RCTAsyncLocalStorage_${THEME_KEY}`];
    for (const k of keys) {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      if (isThemeId(raw)) return raw;
      try {
        const parsed = JSON.parse(raw);
        if (isThemeId(parsed)) return parsed;
      } catch {
        /* not JSON */
      }
    }
  } catch {
    /* private mode */
  }
  return DEFAULT_THEME_ID;
}

function applyDomTheme(id: ThemeId) {
  if (typeof document === 'undefined') return;
  const bg = THEMES[id]?.colors?.bg;
  try {
    document.documentElement.dataset.theme = id;
    if (bg) {
      document.documentElement.style.backgroundColor = bg;
      if (document.body) document.body.style.backgroundColor = bg;
    }
  } catch {
    /* ignore */
  }
}

function persistTheme(id: ThemeId) {
  void AsyncStorage.setItem(THEME_KEY, id);
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, id);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const id = readThemeIdSync();
    applyDomTheme(id);
    return id;
  });
  const [ready, setReady] = useState(() => typeof window !== 'undefined');

  useEffect(() => {
    const id = readThemeIdSync();
    setThemeIdState((cur) => (cur === id ? cur : id));
    applyDomTheme(id);
    persistTheme(id);
    setReady(true);
  }, []);

  useEffect(() => {
    applyDomTheme(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    applyDomTheme(id);
    persistTheme(id);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeIdState((cur) => {
      const i = THEME_ORDER.indexOf(cur);
      const next = THEME_ORDER[(i + 1) % THEME_ORDER.length];
      applyDomTheme(next);
      persistTheme(next);
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
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
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
