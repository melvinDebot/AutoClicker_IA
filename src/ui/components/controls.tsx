import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icon, type IconName } from '../Icon';
import { colors, HIT, type TileTone } from '../theme';
import { Tile } from './Card';
import { Text } from './Text';

/** Settings block (`.cfg` in the prototype). */
export function SettingBlock({ children }: { children: ReactNode }) {
  return <View style={styles.block}>{children}</View>;
}

export function SettingHeader({
  icon,
  tone,
  title,
  description,
  iconFill,
  right,
}: {
  icon: IconName;
  tone: TileTone;
  title: string;
  description?: string;
  iconFill?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Tile icon={icon} tone={tone} iconFill={iconFill} />
      <View style={styles.rowText}>
        <Text weight="bold">{title}</Text>
        {description ? (
          <Text size={13} color={colors.textMuted} style={styles.desc}>
            {description}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SwitchRow(props: {
  icon: IconName;
  tone: TileTone;
  title: string;
  description?: string;
  iconFill?: boolean;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { value, onChange, ...header } = props;
  return (
    <SettingHeader
      {...header}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.switchOff, true: colors.primary }}
          ios_backgroundColor={colors.switchOff}
          accessibilityLabel={props.title}
          accessibilityHint={props.description}
        />
      }
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${label} : ${o.label}`}
            onPress={() => onChange(o.value)}
            style={[styles.segBtn, on && styles.segOn]}
          >
            <Text weight="bold" size={14} color={on ? colors.text : colors.textMuted}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RadioGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={styles.radios} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.sub ? `${o.label}, ${o.sub}` : o.label}
            onPress={() => onChange(o.value)}
            style={[styles.radioRow, on && styles.radioRowOn]}
          >
            <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
            <Text weight="bold" size={15} style={styles.flex}>
              {o.label}
            </Text>
            {o.sub ? (
              <Text size={12.5} color={colors.textMuted}>
                {o.sub}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** − value + control, exposed to VoiceOver as an adjustable element. */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
    >
      <Text weight="bold" size={15} style={styles.flex}>
        {label}
      </Text>
      <Pressable
        onPress={() => set(value - step)}
        disabled={value <= min}
        style={styles.stepBtn}
        importantForAccessibility="no"
      >
        <Text weight="bold" size={20} color={value <= min ? colors.textDisabled : colors.accent}>
          −
        </Text>
      </Pressable>
      <Text weight="extrabold" size={16} tabular style={styles.stepValue}>
        {value}
      </Text>
      <Pressable
        onPress={() => set(value + step)}
        disabled={value >= max}
        style={styles.stepBtn}
        importantForAccessibility="no"
      >
        <Text weight="bold" size={20} color={value >= max ? colors.textDisabled : colors.accent}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

export function InfoRow({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  return (
    <View style={styles.infoRow} accessible accessibilityLabel={`${label} : ${value}`}>
      {icon ? <Icon name={icon} size={16} color={colors.textMuted} /> : null}
      <Text size={14} color={colors.textMuted} style={styles.flex}>
        {label}
      </Text>
      <Text weight="bold" size={14} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    marginTop: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  desc: { lineHeight: 18 },
  seg: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.inset,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segBtn: { flex: 1, minHeight: HIT, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.primary },
  radios: { gap: 8 },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.inset,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radioRowOn: { borderColor: 'rgba(143,127,255,0.55)', backgroundColor: 'rgba(99,82,245,0.10)' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#5A5874',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accentStrong },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentStrong },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 14,
    backgroundColor: colors.inset,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 36, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
});
