import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts, type FontWeight } from '../theme';

type Props = TextProps & {
  weight?: FontWeight;
  size?: number;
  color?: string;
  /** Tabular figures for counters and timers. */
  tabular?: boolean;
};

/** Text in Plus Jakarta Sans. Dynamic Type stays enabled (RN default). */
export function Text({ weight = 'regular', size = 16, color = colors.text, tabular, style, ...rest }: Props) {
  const base: TextStyle = {
    fontFamily: fonts[weight],
    fontSize: size,
    lineHeight: Math.round(size * 1.35),
    color,
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  };
  return <RNText {...rest} style={[base, style]} maxFontSizeMultiplier={1.6} />;
}
