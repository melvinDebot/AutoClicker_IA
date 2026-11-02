import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../Icon';
import { colors, tiles, type TileTone } from '../theme';
import { Text } from './Text';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Tile({
  icon,
  tone,
  size = 42,
  iconFill,
}: {
  icon: IconName;
  tone: TileTone;
  size?: number;
  iconFill?: boolean;
}) {
  const t = tiles[tone];
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.31), backgroundColor: t.bg }]}
      accessible={false}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.fg} fill={iconFill} />
    </View>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text weight="bold" size={13} color={colors.textFaint} style={styles.section} accessibilityRole="header">
      {title.toUpperCase()}
    </Text>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleWrap}>
      <Text weight="extrabold" size={32} style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text size={14.5} color={colors.textMuted}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Stat({
  value,
  label,
  icon,
  tone,
  iconFill,
}: {
  value: string | number;
  label: string;
  icon?: IconName;
  tone?: TileTone;
  iconFill?: boolean;
}) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      {icon && tone ? <Tile icon={icon} tone={tone} size={34} iconFill={iconFill} /> : null}
      <Text weight="extrabold" size={22} tabular>
        {value}
      </Text>
      <Text size={12} color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
  },
  tile: { alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 26, marginBottom: 10, marginHorizontal: 4, letterSpacing: 0.8 },
  titleWrap: { paddingTop: 16, gap: 4 },
  title: { lineHeight: 40, letterSpacing: -0.6 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 8,
  },
});
