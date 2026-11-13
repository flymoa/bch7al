import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | 'light' | 'dark';

const light = {
  bg: '#F4F7FF',
  card: '#FFFFFF',
  cardPressed: '#F0F4FF',
  blue: '#1F4BFF',
  ink: '#0B1B4D',
  onInk: '#FFFFFF', // text on an "ink" background (selected pill, toast)
  muted: '#46557F',
  soft: '#E6EDFF',
  softText: '#1F4BFF',
  accent: '#A9BCFF',
  barSoft: '#C9D6FF',
  neutral: '#EEF2FB',
  line: '#D5DFFA',
  border: '#B9C8F2',
  // "Ghali" (more expensive): no warm colour, a white box with a navy outline.
  upBg: '#FFFFFF',
  upText: '#0B1B4D',
  danger: '#B42318',
  white: '#FFFFFF', // text and icons on blue
  shadow: '#0B1B4D',
  // The deep-navy "night" cards (hero blocks) and what sits on them.
  night: '#0B1B4D',
  nightSoft: '#16296B',
  onNight: '#C3D0FF',
  nightBlue: '#4D6FFF',
};

const dark: typeof light = {
  bg: '#060D26',
  card: '#101C45',
  cardPressed: '#16255A',
  blue: '#4266FF',
  ink: '#EEF2FF',
  onInk: '#060D26',
  muted: '#A3B0D9',
  soft: '#182A66',
  softText: '#C3D0FF',
  accent: '#A9BCFF',
  barSoft: '#2A3F8C',
  neutral: '#141F47',
  line: '#22316B',
  border: '#34468A',
  upBg: '#060D26',
  upText: '#FFFFFF',
  danger: '#FF7A6E',
  white: '#FFFFFF',
  shadow: '#000000',
  night: '#16296B',
  nightSoft: '#22388A',
  onNight: '#C3D0FF',
  nightBlue: '#7C97FF',
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
  title: 'ReadexPro_600SemiBold',
  titleBold: 'ReadexPro_700Bold',
  body: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
};

export const UNITS = ['pièce', 'kg', 'L', 'paquet'] as const;
export type Unit = (typeof UNITS)[number];

export { DEFAULT_STORES } from './theme-constants';
