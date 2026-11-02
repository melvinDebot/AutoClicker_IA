import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SessionStatus } from '@/engine/types';
import type { IconName } from '../Icon';
import { colors, gradients, type TileTone } from '../theme';
import { Text } from './Text';

export const STATUS_LABEL: Record<SessionStatus, string> = {
  running: 'En cours',
  paused: 'En pause',
  done: 'Terminée',
  interrupted: 'Interrompue',
};

export const STATUS_TILE: Record<SessionStatus, { tone: TileTone; icon: IconName; fill?: boolean }> = {
  running: { tone: 'teal', icon: 'play', fill: true },
  paused: { tone: 'yellow', icon: 'pause' },
  done: { tone: 'violet', icon: 'check' },
  interrupted: { tone: 'pink', icon: 'alert' },
};

const STATUS_STYLE: Record<SessionStatus, { bg: string; fg: string }> = {
  running: { bg: 'rgba(52,211,153,0.14)', fg: '#4ADE9B' },
  paused: { bg: 'rgba(245,184,61,0.15)', fg: '#F5B83D' },
  done: { bg: 'rgba(143,127,255,0.16)', fg: '#B4A9FF' },
  interrupted: { bg: 'rgba(255,90,110,0.15)', fg: '#FF8F9C' },
};

export function StatusChip({ status }: { status: SessionStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Text weight="bold" size={12} color={s.fg}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View
      style={styles.bar}
      accessible={!!label}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <LinearGradient
        colors={gradients.bar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.barFill, { width: `${clamped}%` }]}
      />
    </View>
  );
}

// ---- Toast ----

const ToastContext = createContext<(text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (t: string) => {
      if (timer.current) clearTimeout(timer.current);
      setText(t);
      AccessibilityInfo.announceForAccessibility(t);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setText(null));
      }, 2400);
    },
    [opacity],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {text ? (
        <Animated.View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + 12, opacity }]}>
          <View style={styles.toast}>
            <Text weight="semibold" size={14} style={styles.center}>
              {text}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  chip: { height: 26, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center', alignSelf: 'flex-start' },
  bar: { height: 6, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 80 },
  toast: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(143,127,255,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  center: { textAlign: 'center' },
});
