// The one spacing / radius / type scale. Every padding, margin, gap, radius and fontSize comes from here.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 14, lg: 24, pill: 999 } as const; // bubble() keeps using radius.lg
export const type = {
  caption: 12, body: 15, bodyLg: 17, title: 20, h1: 28, price: 34, priceHero: 48,
} as const;
/** Prices line up digit for digit. */
export const tabular = { fontVariant: ['tabular-nums'] as 'tabular-nums'[] };
