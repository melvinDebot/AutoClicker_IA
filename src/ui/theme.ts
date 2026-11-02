// Values taken from the interface prototype (dark / violet theme).
export const colors = {
  bg: '#100F1A',
  card: '#1B1A28',
  cardPressed: '#211F31',
  sheet: '#16151F',
  surface: '#232235',
  surfaceAlt: '#262539',
  inset: '#14131E',
  track: '#2A2940',
  switchOff: '#3A3950',

  text: '#FFFFFF',
  textMuted: '#A9A6C4',
  textSoft: '#C4C1DA',
  textFaint: '#8C89A8',
  textDisabled: '#4A4864',
  chevron: '#6E6B8A',

  accent: '#A99CFF',
  accentStrong: '#8F7FFF',
  primary: '#6352F5',
  primaryEnd: '#4F66F0',

  success: '#34D399',
  successText: '#4ADE9B',
  danger: '#FF4D6D',
  dangerText: '#FF8F9C',
  dangerBg: 'rgba(255,90,110,0.12)',
  warning: '#F5B83D',

  border: 'rgba(255,255,255,0.05)',
  borderStrong: 'rgba(255,255,255,0.08)',
  scrim: 'rgba(5,4,12,0.6)',
} as const;

export const gradients = {
  primary: [colors.primary, colors.primaryEnd] as const,
  logo: ['#7B6BFF', colors.primaryEnd] as const,
  bar: [colors.primary, colors.accentStrong] as const,
};

export const tiles = {
  violet: { bg: '#6352F5', fg: '#FFFFFF' },
  lavender: { bg: '#9C8CFF', fg: '#1B1440' },
  yellow: { bg: '#F5B83D', fg: '#3A2600' },
  teal: { bg: '#22B796', fg: '#04261F' },
  pink: { bg: '#FF4D6D', fg: '#FFFFFF' },
  gray: { bg: '#3A3950', fg: '#FFFFFF' },
} as const;
export type TileTone = keyof typeof tiles;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;
export type FontWeight = keyof typeof fonts;

export const radius = { sm: 10, md: 13, lg: 16, xl: 20, sheet: 24, pill: 999 } as const;

/** Minimum touch target (iOS HIG). */
export const HIT = 44;
