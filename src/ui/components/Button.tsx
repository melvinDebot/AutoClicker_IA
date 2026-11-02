import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../Icon';
import { colors, gradients } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'dark' | 'danger' | 'success' | 'ghost';
type Size = 'sm' | 'md' | 'xl';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconFill?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<Size, number> = { sm: 44, md: 54, xl: 58 };
const FONT: Record<Size, number> = { sm: 15, md: 17, xl: 18 };
const RADIUS: Record<Size, number> = { sm: 13, md: 16, xl: 18 };

const FG: Record<Variant, string> = {
  primary: colors.text,
  dark: colors.text,
  danger: colors.dangerText,
  success: '#052E1F',
  ghost: colors.accent,
};
const BG: Record<Variant, string> = {
  primary: colors.primary,
  dark: colors.surfaceAlt,
  danger: colors.dangerBg,
  success: colors.success,
  ghost: 'transparent',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconFill,
  disabled,
  accessibilityHint,
  style,
}: Props) {
  const fg = FG[variant];
  const shape: ViewStyle = { minHeight: HEIGHT[size], borderRadius: RADIUS[size] };
  const content = (
    <View style={[styles.content, shape]}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} color={fg} fill={iconFill} /> : null}
      <Text weight="bold" size={FONT[size]} color={fg}>
        {label}
      </Text>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        shape,
        styles.base,
        variant === 'primary' ? styles.glow : { backgroundColor: BG[variant] },
        { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={shape}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'visible' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 },
  glow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
});
