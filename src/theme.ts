// Runtime theme: turns the tokens into React Native styles for the current scheme.
import { createContext, useContext } from 'react';
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { bulle, elevation, fontFiles, motion, palette, pricePalette, typeScale } from './tokens';

export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | 'light' | 'dark';

/** Current palette. Its values are swapped in place when the scheme changes. */
export const colors: { -readonly [K in keyof typeof palette.light]: string } = { ...palette.light };
/** Price-direction colours for the current scheme. */
export const price: { -readonly [K in keyof typeof pricePalette.light]: string } = { ...pricePalette.light };

let current: Scheme = 'light';
let version = 0;

export function applyScheme(scheme: Scheme) {
  if (scheme === current) return;
  current = scheme;
  version++;
  Object.assign(colors, palette[scheme]);
  Object.assign(price, pricePalette[scheme]);
}

export function currentScheme(): Scheme {
  return current;
}

/**
 * Like StyleSheet.create, but rebuilt from the current palette whenever the scheme
 * changes. Use `st.card` exactly like a normal style.
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

/** Call in a screen so it re-renders with the new colours when the theme changes. */
export function useTheme() {
  return useContext(ThemeContext);
}

export const fonts = fontFiles;

/** A text style from the type scale (colour added by the caller). */
export function text(token: keyof typeof typeScale): TextStyle {
  const t = typeScale[token] as { font: keyof typeof fontFiles; size: number; line: number; track: number; tnum?: boolean };
  return {
    fontFamily: fontFiles[t.font],
    fontSize: t.size,
    lineHeight: t.line,
    letterSpacing: t.track,
    ...(t.tnum ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null),
  };
}

/** The signature « bulle » shape: round corners, the bottom-left one sharp (mirrors in RTL). */
export function bubble(kind: keyof typeof bulle = 'lg'): ViewStyle {
  const { r, tail } = bulle[kind];
  return { borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomRightRadius: r, borderBottomLeftRadius: tail };
}
/** Mirror of `bubble` (an answer on the right). */
export function bubbleRight(kind: keyof typeof bulle = 'lg'): ViewStyle {
  const { r, tail } = bulle[kind];
  return { borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: r, borderBottomRightRadius: tail };
}

/** Night-tinted float shadow, only for the FAB and sheets. */
export function floatShadow(kind: keyof typeof elevation = 'fab'): ViewStyle {
  const e = elevation[kind];
  return Platform.select({
    android: { elevation: e.android, shadowColor: colors.shadow },
    default: { shadowColor: colors.shadow, shadowOpacity: e.opacity, shadowRadius: e.blur / 2, shadowOffset: { width: 0, height: e.y } },
  }) as ViewStyle;
}

/** Animated.spring config from a Material spring token (damping ratio → damping, mass 1). */
export function spring(token: { ratio: number; stiffness: number }) {
  return { stiffness: token.stiffness, damping: token.ratio * 2 * Math.sqrt(token.stiffness), mass: 1 };
}
export { motion };

export const UNITS = ['pièce', 'kg', 'L', 'paquet'] as const;
export type Unit = (typeof UNITS)[number];

export { DEFAULT_STORES } from './theme-constants';
