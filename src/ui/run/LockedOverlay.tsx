import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Progress } from '@/engine/ports';
import { formatDuration, progressPct } from '@/engine/stats';
import { Avatar, ProgressBar, Text } from '../components';
import { Icon } from '../Icon';
import { colors } from '../theme';

const HOLD_MS = 1500;

/** "Maintenir pour arrêter": ~1.5 s hold; VoiceOver users stop with a double tap (activate action). */
function HoldToStop({ onStop }: { onStop: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const done = useRef(false);

  const start = () => {
    done.current = false;
    anim.current = Animated.timing(v, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (!finished) return;
      done.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      onStop();
    });
  };
  const release = () => {
    if (done.current) return;
    anim.current?.stop();
    Animated.timing(v, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={release}
      style={styles.hold}
      accessibilityRole="button"
      accessibilityLabel="Arrêter la session"
      accessibilityHint="Maintenez environ une seconde et demie. Avec VoiceOver, touchez deux fois."
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onStop()}
    >
      <Animated.View style={[styles.holdFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      <View style={styles.holdLbl}>
        <Icon name="stop" size={20} fill color={colors.text} />
        <Text weight="bold" size={15.5}>
          Maintenir pour arrêter
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Locked mode: a transparent full-screen layer over the WebView. It blocks every touch,
 * greys the page, and shows the HUD. The WebView keeps running underneath.
 */
export function LockedOverlay({
  visible,
  account,
  progress,
  startedAt,
  previousElapsedMs,
  dryRun,
  onStop,
}: {
  visible: boolean;
  account: string;
  progress: Progress | null;
  startedAt: number;
  previousElapsedMs: number;
  dryRun: boolean;
  onStop: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());
  const [hint, setHint] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    if (!progress?.flash) return;
    setFlash(progress.flash);
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [progress]);

  useEffect(() => {
    if (progress?.text) AccessibilityInfo.announceForAccessibility(progress.text);
  }, [progress?.text]);

  const tapped = () => {
    setHint('Écran verrouillé · maintenez « Arrêter » pour reprendre la main');
    setTimeout(() => setHint(null), 2400);
  };

  const p = progress;
  const likes = p ? p.likes.story + p.likes.post : 0;
  const pct = p ? progressPct(p.processed, p.discovered) : 0;
  const elapsed = previousElapsedMs + (now - startedAt);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.fill} accessibilityViewIsModal>
        <Pressable style={styles.grey} onPress={tapped} accessibilityLabel="Écran verrouillé pendant la session" />

        <View style={[styles.pill, { top: insets.top + 8 }]} accessibilityRole="text">
          <View style={styles.dot} />
          <Text weight="bold" size={13}>
            Écran verrouillé · {dryRun ? 'essai à blanc' : 'session en cours'}
          </Text>
        </View>
        {hint ? (
          <View style={[styles.hint, { top: insets.top + 52 }]} pointerEvents="none">
            <Text weight="semibold" size={14} style={styles.center}>
              {hint}
            </Text>
          </View>
        ) : null}

        <View style={[styles.hud, { bottom: insets.bottom + 10 }]}>
          <View style={styles.hudRow}>
            <Avatar username={p?.username ?? account} size={40} />
            <View style={styles.flex}>
              <Text weight="bold" size={15} numberOfLines={1}>
                {p?.username ? `@${p.username}` : `Session @${account}`}
              </Text>
              <Text size={13.5} color={colors.textSoft} numberOfLines={2} accessibilityLiveRegion="polite">
                {p?.text ?? 'Comptes visibles détectés · démarrage'}
              </Text>
            </View>
            {flash ? (
              <View style={styles.flash}>
                <Icon name="heart" size={14} fill color={colors.text} />
                <Text weight="extrabold" size={12}>
                  {flash}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.meta}>
            <Text size={12} color={colors.textMuted} tabular>
              Compte {p?.index ?? 0} · {p?.discovered ?? 0} détectés
            </Text>
            <Text size={12} color={colors.textMuted} tabular>
              {dryRun ? `${p?.dryLikes ?? 0} simulés` : `${likes} like${likes > 1 ? 's' : ''}`}
            </Text>
            <Text size={12} color={colors.textMuted} tabular>
              {formatDuration(elapsed)}
            </Text>
          </View>
          <ProgressBar pct={pct} label={`${p?.processed ?? 0} comptes traités sur ${p?.discovered ?? 0} détectés`} />
          <HoldToStop onStop={onStop} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 1 },
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  grey: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,12,30,0.28)' },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(22,21,31,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(143,127,255,0.4)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  hint: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(143,127,255,0.4)',
  },
  hud: {
    position: 'absolute',
    left: 10,
    right: 10,
    padding: 14,
    gap: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(22,21,31,0.97)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  flash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.danger,
  },
  hold: { height: 50, borderRadius: 15, backgroundColor: colors.track, overflow: 'hidden', justifyContent: 'center' },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.danger },
  holdLbl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
