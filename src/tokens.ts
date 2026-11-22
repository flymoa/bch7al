// bch7al? v4 « Majorelle Nuit » — the ONE source of truth for the design.
// Colours, type, spacing, radii, elevation and motion all live here. Screens never use a
// hex value or a raw number for padding / radius / font size: they read these tokens.
// `npm run design:doc` regenerates DESIGN.md from this file, so the spec and the app
// can never drift apart. Plain data only: safe to import from Node scripts.

// ---------------------------------------------------------------- colour
// Blue and white only. No green, no red, no yellow — not even for "good / bad" prices.
// Price direction is carried by weight + fill + an arrow + a word, never by hue alone.

export const palette = {
  light: {
    // brand
    primary: '#2E3FD1', //            « Majorelle profond », 7.64:1 on white
    onPrimary: '#FFFFFF',
    primaryContainer: '#DFE0FF',
    onPrimaryContainer: '#00149E',
    // the night-ink hero block (month total, verdicts on lookup, splash)
    hero: '#0E1340', //               « Encre de nuit », 17.71:1 on white
    onHero: '#FFFFFF',
    onHeroMuted: '#BDC2FF',
    heroRaised: '#232A6B',
    // surfaces (tonal, no shadows on lists)
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceLow: '#FBF8FE',
    surfaceContainer: '#F5F2F9',
    surfaceHigh: '#F0EDF3',
    surfaceHighest: '#EAE7ED',
    pressed: '#EAE7ED',
    // text
    ink: '#0E1340', //                onSurface
    muted: '#464650', //              onSurfaceVariant, 9.32:1
    faint: '#6A6A76', //              placeholders, hints — 4.8:1 on surfaceContainer
    // lines
    outline: '#767681', //            meaningful borders (inputs), 3:1+
    line: '#DAD9E5', //               dividers only — decorative
    // secondary « Nuit » (navigation indicator, quiet buttons)
    secondaryContainer: '#E3E1EE',
    onSecondaryContainer: '#0E1340',
    // tertiary « Ciel » — the cheaper side
    sky: '#006590',
    skyContainer: '#C8E6FF',
    onSkyContainer: '#004C6E',
    // error « Mûre » (plum, hue 336 — far from red). Destructive actions + form errors only.
    error: '#8C4383',
    errorContainer: '#FFD7F4',
    onErrorContainer: '#702B6A',
    // inverse (toast)
    inverseSurface: '#0E1340',
    inverseOnSurface: '#F4F2FF',
    scrim: 'rgba(14,19,64,0.45)',
    shadow: '#0E1340',
  },
  dark: {
    primary: '#BDC2FF',
    onPrimary: '#00149E',
    primaryContainer: '#1C2EC5',
    onPrimaryContainer: '#DFE0FF',
    hero: '#1C2EC5',
    onHero: '#FFFFFF',
    onHeroMuted: '#DFE0FF',
    heroRaised: '#3445D6',
    bg: '#0F1129',
    surface: '#0F1129',
    surfaceLow: '#171A31',
    surfaceContainer: '#1B1E35',
    surfaceHigh: '#252840',
    surfaceHighest: '#30334C',
    pressed: '#30334C',
    ink: '#E9E7F3',
    muted: '#C7C5D1',
    faint: '#90909B',
    outline: '#90909B',
    line: '#42455F',
    secondaryContainer: '#353750',
    onSecondaryContainer: '#DFE0FF',
    sky: '#89CEFF',
    skyContainer: '#004C6E',
    onSkyContainer: '#C8E6FF',
    error: '#FFABF0',
    errorContainer: '#702B6A',
    onErrorContainer: '#FFD7F4',
    inverseSurface: '#E9E7F3',
    inverseOnSurface: '#0F1129',
    scrim: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
  },
} as const;

/** Price-direction colours. ALWAYS shown with an arrow, a +/− sign and a word. */
export const pricePalette = {
  light: {
    upBg: '#0E1340', upFg: '#FFFFFF', //       « Ghali / plus cher » — heavy, solid night
    downBg: '#C8E6FF', downFg: '#004C6E', //   « Rkhis / moins cher » — light sky
    sameBg: '#F0EDF3', sameFg: '#464650', //   « Normal / même prix »
    warnBorder: '#464650', warnFg: '#0E1340', // « À vérifier » — dashed border, no hue
    // on the night hero block the heavy chip inverts
    upOnHeroBg: '#FFFFFF', upOnHeroFg: '#0E1340',
    downOnHeroBg: '#C8E6FF', downOnHeroFg: '#004C6E',
    sameOnHeroBg: '#232A6B', sameOnHeroFg: '#DFE0FF',
    // charts
    chartLine: '#767681', chartAccent: '#2E3FD1', chartMin: '#007FB5', chartNeutral: '#78767C',
    band: 'rgba(223,224,255,0.6)', motif: 'rgba(46,63,209,0.06)',
  },
  dark: {
    upBg: '#E9E7F3', upFg: '#0F1129',
    downBg: '#004C6E', downFg: '#C8E6FF',
    sameBg: '#252840', sameFg: '#C7C5D1',
    warnBorder: '#C7C5D1', warnFg: '#E9E7F3',
    upOnHeroBg: '#FFFFFF', upOnHeroFg: '#1C2EC5',
    downOnHeroBg: '#C8E6FF', downOnHeroFg: '#004C6E',
    sameOnHeroBg: '#3445D6', sameOnHeroFg: '#FFFFFF',
    chartLine: '#90909B', chartAccent: '#BDC2FF', chartMin: '#50B4F1', chartNeutral: '#919095',
    band: 'rgba(28,46,197,0.28)', motif: 'rgba(189,194,255,0.06)',
  },
} as const;

/** Fixed brand colours (icon, splash) — not themed. */
export const brand = { majorelle: '#2E3FD1', night: '#0E1340', white: '#FFFFFF', sky: '#C8E6FF' } as const;

// ---------------------------------------------------------------- type
// Kufam (display, numbers that are heroes) + IBM Plex Sans Arabic (everything else).
// Both OFL, both carry Arabic incl. ڭ ڤ گ, both have tabular digits.

export const fontFiles = {
  display: 'Kufam_600SemiBold',
  displayBold: 'Kufam_700Bold',
  text: 'IBMPlexSansArabic_400Regular',
  textMedium: 'IBMPlexSansArabic_500Medium',
  textSemi: 'IBMPlexSansArabic_600SemiBold',
  textBold: 'IBMPlexSansArabic_700Bold',
} as const;

type TypeToken = { font: keyof typeof fontFiles; size: number; line: number; track: number; tnum?: boolean; use: string };

export const typeScale = {
  priceHero: { font: 'display', size: 44, line: 52, track: -0.5, tnum: true, use: 'Month total, lookup answer' },
  display: { font: 'display', size: 36, line: 44, track: -0.25, tnum: true, use: 'Trip total, product price' },
  headline: { font: 'display', size: 28, line: 36, track: 0, use: 'Screen titles (Ton mois, Produits…)' },
  headlineSm: { font: 'display', size: 24, line: 32, track: 0, use: 'Verdict word, section heroes' },
  titleLg: { font: 'textSemi', size: 20, line: 28, track: 0, use: 'Brand name, sheet titles' },
  title: { font: 'textSemi', size: 16, line: 24, track: 0.1, use: 'Row titles, store names' },
  titleSm: { font: 'textSemi', size: 14, line: 20, track: 0.1, use: 'Group headers' },
  body: { font: 'text', size: 16, line: 24, track: 0.15, use: 'Inputs, primary body' },
  bodySm: { font: 'text', size: 14, line: 20, track: 0.2, use: 'Secondary text, explanations' },
  caption: { font: 'text', size: 12, line: 16, track: 0.3, use: 'Meta (date, il y a 12 j)' },
  label: { font: 'textMedium', size: 14, line: 20, track: 0.1, use: 'Buttons, tabs' },
  labelSm: { font: 'textMedium', size: 12, line: 16, track: 0.4, use: 'Chips' },
  overline: { font: 'textSemi', size: 11, line: 16, track: 0.8, use: 'Section overlines (DERNIÈRE COURSE)' },
  priceRow: { font: 'textSemi', size: 16, line: 24, track: 0, tnum: true, use: 'Right-aligned list prices' },
  priceUnit: { font: 'text', size: 12, line: 16, track: 0.2, tnum: true, use: '21,50 DH/L' },
  priceDelta: { font: 'textSemi', size: 13, line: 16, track: 0.2, tnum: true, use: '+2,50 DH chips' },
} as const satisfies Record<string, TypeToken>;

// ---------------------------------------------------------------- space, radius, size

/** 4 dp grid. The jump 16 → 32 between sections is what makes hierarchy felt. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32, x3: 40, x4: 56 } as const;

export const radius = { sm: 8, md: 12, card: 16, hero: 28, pill: 999 } as const;

/** The signature « bulle » shape (from the logo): three round corners, the bottom-left one sharp. */
export const bulle = { lg: { r: 20, tail: 6 }, sm: { r: 12, tail: 4 }, hero: { r: 28, tail: 8 } } as const;

export const size = {
  screen: 20, //        horizontal screen margin
  row: 64, //           list row height
  rowDense: 52,
  touch: 48, //         minimum tap target
  button: 52,
  input: 52,
  icon: 24, iconDense: 20, iconInline: 16, iconEmpty: 72,
  lead: 40, //          row leading tile
  tabBar: 64,
  fab: 60,
  sparkW: 64, sparkH: 20,
} as const;

/** Shadows only on things that float: FAB, sheets, dragged items. Tinted night, never grey. */
export const elevation = {
  fab: { y: 6, blur: 16, opacity: 0.18, android: 6 },
  sheet: { y: -4, blur: 24, opacity: 0.14, android: 12 },
} as const;

// ---------------------------------------------------------------- motion
// Material 3 spring tokens (damping ratio, stiffness). Spatial = things that move,
// effects = colour / opacity (no overshoot).
export const motion = {
  spatial: { fast: { ratio: 0.9, stiffness: 1400 }, default: { ratio: 0.9, stiffness: 700 }, slow: { ratio: 0.9, stiffness: 300 } },
  effects: { fast: { ratio: 1, stiffness: 3800 }, default: { ratio: 1, stiffness: 1600 }, slow: { ratio: 1, stiffness: 800 } },
  splash: { bubbleMs: 280, sevenStartMs: 160, sevenMs: 300, exitMs: 200 }, // icon done at 460 ms, never held
  fadeMs: 180,
  stagger: 30,
} as const;

/** Price verdict rule: within ±5 % of your usual price is « Normal ». */
export const verdictBand = 5;
