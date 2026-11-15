import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | 'light' | 'dark';

// v3 "Majorelle": the blue of Marrakech's Jardin Majorelle, on white.
const light = {
  bg: '#F7F7FF', // paper
  card: '#FFFFFF',
  cardPressed: '#F0F0FF',
  blue: '#3D3BD9', // Majorelle
  ink: '#12133D',
  onInk: '#FFFFFF', // text on an "ink" background (selected pill, toast)
  muted: '#4A4C7A',
  soft: '#E4E6FF', // sky
  softText: '#3D3BD9',
  accent: '#8F8CFF',
  barSoft: '#C8CCFF',
  neutral: '#EEEFFA',
  line: '#DCDEF5',
  border: '#C8CCFF',
  // "Ghali" (more expensive): a white box with an ink outline, never a warm colour.
  upBg: '#FFFFFF',
  upText: '#12133D',
  danger: '#B42318',
  white: '#FFFFFF', // text and icons on blue
  shadow: '#12133D',
  // Dark "ink" blocks and what sits on them.
  night: '#12133D',
  nightSoft: '#24275E',
  onNight: '#C9C8FF',
  nightBlue: '#8F8CFF',
  // Light text on Majorelle.
  onBlue: '#D6D5FF',
};

const dark: typeof light = {
  bg: '#0C0D2B',
  card: '#181A45',
  cardPressed: '#20235A',
  blue: '#4E4CF0',
  ink: '#EDEDFF',
  onInk: '#0C0D2B',
  muted: '#A6A8D6',
  soft: '#24275E',
  softText: '#B4B2FF',
  accent: '#8F8CFF',
  barSoft: '#2E3070',
  neutral: '#1C1E4D',
  line: '#2A2D66',
  border: '#3A3D80',
  upBg: '#0C0D2B',
  upText: '#FFFFFF',
  danger: '#FF7A6E',
  white: '#FFFFFF',
  shadow: '#000000',
  night: '#181A45',
  nightSoft: '#24275E',
  onNight: '#C9C8FF',
  nightBlue: '#8F8CFF',
  onBlue: '#D6D5FF',
};

/** The bubble shape of the logo: round corners, the bottom-left one tighter. */
export const bubble = (r = 24) => ({ borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomRightRadius: r, borderBottomLeftRadius: Math.round(r / 3) });
/** Mirror of `bubble`, for answers on the right. */
export const bubbleRight = (r = 24) => ({ borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: r, borderBottomRightRadius: Math.round(r / 3) });

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
    shadowOpacity: current === 'dark' ? 0.35 : 0.06,
    shadowRadius: 14,
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
  title: 'Rubik_600SemiBold',
  titleBold: 'Rubik_700Bold',
  body: 'Rubik_400Regular',
  bodyMedium: 'Rubik_500Medium',
  bodyBold: 'Rubik_600SemiBold',
};

export const UNITS = ['pièce', 'kg', 'L', 'paquet'] as const;
export type Unit = (typeof UNITS)[number];

export { DEFAULT_STORES } from './theme-constants';
