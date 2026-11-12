import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | 'light' | 'dark';

const light = {
  bg: '#F4F7FB',
  card: '#FFFFFF',
  cardPressed: '#F7F9FD',
  blue: '#1D4ED8',
  ink: '#14213D',
  onInk: '#FFFFFF', // text on an "ink" background (selected pill, toast)
  muted: '#55607A',
  soft: '#E3ECFD',
  softText: '#1E3FAE',
  accent: '#A9C5FF',
  barSoft: '#C9D8FA',
  neutral: '#EEF2F8',
  line: '#E6EBF3',
  border: '#CBD5E4',
  upBg: '#FDEBD3',
  upText: '#8A4300',
  danger: '#B42318',
  white: '#FFFFFF', // text and icons on blue
  shadow: '#14213D',
};

const dark: typeof light = {
  bg: '#0B1220',
  card: '#151E30',
  cardPressed: '#1B263B',
  blue: '#3366F0',
  ink: '#E8EEF8',
  onInk: '#0B1220',
  muted: '#9AA6BC',
  soft: '#1C2A4A',
  softText: '#A9C5FF',
  accent: '#A9C5FF',
  barSoft: '#2A3B63',
  neutral: '#1E2738',
  line: '#243049',
  border: '#33405A',
  upBg: '#3A2A12',
  upText: '#FFC27A',
  danger: '#FF7A6E',
  white: '#FFFFFF',
  shadow: '#000000',
};

/** Current palette. Its values are swapped in place when the scheme changes. */
export const colors = { ...light };
let current: Scheme = 'light';
let version = 0;

export function applyScheme(scheme: Scheme) {
  if (scheme === current) return;
  current = scheme;
  version++;
  Object.assign(colors, scheme === 'dark' ? dark : light);
  Object.assign(shadow, makeShadow());
}

export function currentScheme(): Scheme {
  return current;
}

function makeShadow() {
  return {
    shadowColor: colors.shadow,
    shadowOpacity: current === 'dark' ? 0.35 : 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: current === 'dark' ? 0 : 2,
  };
}
export const shadow = makeShadow();

/**
 * Like StyleSheet.create, but the styles are rebuilt from the current palette
 * whenever the scheme changes. Use `st.card` exactly as before.
 */
type Styles = Parameters<typeof StyleSheet.create>[0];
export function sheet<T extends Styles>(make: () => T & Styles): Readonly<T> {
  let built: Readonly<T> | null = null;
  let builtFor = -1;
  return new Proxy({} as Readonly<T>, {
    get(_t, key) {
      if (builtFor !== version || !built) {
        built = StyleSheet.create(make());
        builtFor = version;
      }
      return (built as any)[key];
    },
  });
}

export const ThemeContext = createContext<{ scheme: Scheme; pref: ThemePref; setPref: (p: ThemePref) => void }>({
  scheme: 'light',
  pref: 'system',
  setPref: () => {},
});

/** Call in a screen so it re-renders with the new colors when the theme changes. */
export function useTheme() {
  return useContext(ThemeContext);
}

export const fonts = {
  title: 'Fredoka_600SemiBold',
  titleBold: 'Fredoka_700Bold',
  body: 'Nunito_700Bold',
  bodyBold: 'Nunito_800ExtraBold',
};

export const UNITS = ['pièce', 'kg', 'L', 'paquet'] as const;
export type Unit = (typeof UNITS)[number];

export const DEFAULT_STORES = ['Marjane', 'BIM', 'Carrefour', 'Souk', 'Hanout'];
