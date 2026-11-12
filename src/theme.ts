export const colors = {
  bg: '#F4F7FB',
  card: '#FFFFFF',
  blue: '#1D4ED8',
  ink: '#14213D',
  muted: '#55607A',
  soft: '#E3ECFD',
  softText: '#1E3FAE',
  neutral: '#EEF2F8',
  line: '#E6EBF3',
  border: '#CBD5E4',
  upBg: '#FDEBD3',
  upText: '#8A4300',
  danger: '#B42318',
  white: '#FFFFFF',
};

export const fonts = {
  title: 'Fredoka_600SemiBold',
  titleBold: 'Fredoka_700Bold',
  body: 'Nunito_700Bold',
  bodyBold: 'Nunito_800ExtraBold',
};

export const shadow = {
  shadowColor: '#14213D',
  shadowOpacity: 0.07,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

export const UNITS = ['pièce', 'kg', 'L', 'paquet'] as const;
export type Unit = (typeof UNITS)[number];

export const DEFAULT_STORES = ['Marjane', 'BIM', 'Carrefour', 'Souk', 'Hanout'];
