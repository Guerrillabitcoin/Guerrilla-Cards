import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { View } from 'react-native';
import {
  DEFAULT_THEME_ID,
  THEME_ORDER,
  THEMES,
  type AppTheme,
  type ThemeColors,
  type ThemeId,
} from '../theme/themes';

const THEME_KEY = 'guerrilla_theme_v1';
const THEME_COOKIE = 'gc_theme';

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

function storageKeys(): string[] {
  return [
    THEME_KEY,
    `@${THEME_KEY}`,
    `RCTAsyncLocalStorage_${THEME_KEY}`,
  ];
}

function parseThemeRaw(raw: string | null | undefined): ThemeId | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (isThemeId(trimmed)) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (isThemeId(parsed)) return parsed;
  } catch {
    /* not JSON */
  }
  return null;
}

function readCookieTheme(): ThemeId | null {
  if (typeof document === 'undefined') return null;
  try {
    const m = document.cookie.match(/(?:^|;\s*)gc_theme=(guerrilla|classic|oscuro)/);
    if (m && isThemeId(m[1])) return m[1];
  } catch {
    /* ignore */
  }
  return null;
}

/** Sync read for first paint / early bootstrap. */
export function readThemeIdSync(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  try {
    const fromDom = document.documentElement?.dataset?.theme;
    if (isThemeId(fromDom)) return fromDom;
    const fromCookie = readCookieTheme();
    if (fromCookie) return fromCookie;
    for (const k of storageKeys()) {
      const id = parseThemeRaw(window.localStorage.getItem(k));
      if (id) return id;
    }
  } catch {
    /* private mode */
  }
  return DEFAULT_THEME_ID;
}

function fontFor(id: ThemeId): string {
  return THEMES[id]?.fontFamily || THEMES[DEFAULT_THEME_ID].fontFamily;
}

function applyDomTheme(id: ThemeId) {
  if (typeof document === 'undefined') return;
  const bg = THEMES[id]?.colors?.bg;
  const font = fontFor(id);
  try {
    const el = document.documentElement;
    el.dataset.theme = id;
    el.style.backgroundColor = bg || '';
    el.style.fontFamily = font;
    if (document.body) {
      document.body.style.backgroundColor = bg || '';
      document.body.style.fontFamily = font;
    }
    let s = document.getElementById('gc-early-theme') as HTMLStyleElement | null;
    if (!s) {
      s = document.createElement('style');
      s.id = 'gc-early-theme';
      document.head.appendChild(s);
    }
    s.textContent =
      'html{scrollbar-gutter:stable;}' +
      'html,body,#root{background-color:' +
      (bg || '#14081F') +
      '!important;font-family:' +
      font +
      '!important;}';
  } catch {
    /* ignore */
  }
}

function persistTheme(id: ThemeId) {
  void AsyncStorage.setItem(THEME_KEY, id);
  try {
    if (typeof window !== 'undefined') {
      for (const k of storageKeys()) {
        window.localStorage.setItem(k, id);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof document !== 'undefined') {
      document.cookie =
        THEME_COOKIE + '=' + id + ';path=/;max-age=31536000;SameSite=Lax';
    }
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // null = not synced on this client yet (avoids painting DEFAULT then swapping)
  const [themeId, setThemeIdState] = useState<ThemeId | null>(() =>
    typeof window !== 'undefined' ? readThemeIdSync() : null
  );

  useLayoutEffect(() => {
    const id = readThemeIdSync();
    setThemeIdState(id);
    applyDomTheme(id);
    persistTheme(id);
  }, []);

  useLayoutEffect(() => {
    if (themeId) applyDomTheme(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    applyDomTheme(id);
    persistTheme(id);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeIdState((cur) => {
      const base = cur ?? readThemeIdSync();
      const i = THEME_ORDER.indexOf(base);
      const next = THEME_ORDER[(i + 1) % THEME_ORDER.length];
      applyDomTheme(next);
      persistTheme(next);
      return next;
    });
  }, []);

  const activeId = themeId ?? DEFAULT_THEME_ID;
  const theme = THEMES[activeId];
  const ready = themeId !== null;

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId: activeId,
      theme,
      colors: theme.colors,
      fontFamily: theme.fontFamily,
      setThemeId,
      cycleTheme,
      ready,
    }),
    [activeId, theme, setThemeId, cycleTheme, ready]
  );

  // Hold UI until we know the stored skin — only a solid bg (matches early script).
  if (!ready) {
    const boot = typeof window !== 'undefined' ? readThemeIdSync() : DEFAULT_THEME_ID;
    return (
      <View
        style={{ flex: 1, backgroundColor: THEMES[boot].colors.bg }}
        accessibilityLabel="Cargando tema"
      />
    );
  }

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
