import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';

import type { ScanCheck } from '@/engine/ports';
import { Button, Text } from '../components';
import { Icon } from '../Icon';
import { colors, gradients } from '../theme';
import type { Phase } from './useRunner';

function Check({ c, running }: { c: ScanCheck; running: boolean }) {
  const state = c.ok ? 'ok' : running ? 'run' : 'ko';
  return (
    <View style={styles.check} accessible accessibilityLabel={`${c.label} : ${state === 'ok' ? 'oui' : state === 'run' ? 'en cours' : 'non'}`}>
      <View style={[styles.chkIc, state === 'ok' && styles.chkOk, state === 'ko' && styles.chkKo]}>
        {state === 'run' ? (
          <ActivityIndicator size="small" color={colors.accentStrong} />
        ) : (
          <Icon name={state === 'ok' ? 'check' : 'x'} size={14} color={state === 'ok' ? '#052E1F' : '#FFFFFF'} strokeWidth={2.8} />
        )}
      </View>
      <Text size={14.5} weight={state === 'ko' ? 'bold' : 'regular'} color={state === 'ko' ? colors.dangerText : colors.text} style={styles.flex}>
        {c.label}
      </Text>
    </View>
  );
}

/** Dock card of the prototype: scan checks, failure, or the 3 s countdown. */
export function ScanCard({ phase, onCancel }: { phase: Phase; onCancel: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const n = phase.name === 'countdown' ? phase.n : 0;
  useEffect(() => {
    if (!n) return;
    scale.setValue(1.25);
    Animated.timing(scale, { toValue: 1, duration: 350, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
  }, [n, scale]);

  if (phase.name === 'scanning' || phase.name === 'scan_failed') {
    const failed = phase.name === 'scan_failed';
    return (
      <View style={styles.card}>
        <Text weight="extrabold" size={18} accessibilityRole="header">
          {failed ? 'Impossible de lancer' : 'Analyse de l’écran…'}
        </Text>
        <View style={styles.checks}>
          {phase.checks.map((c) => (
            <Check key={c.label} c={c} running={!failed} />
          ))}
        </View>
        {failed ? (
          <>
            <View style={styles.fail} accessibilityLiveRegion="polite">
              <Text size={14} color="#FFB3BC" style={styles.lh}>
                {phase.message}
              </Text>
            </View>
            <Button label="Compris" size="sm" onPress={onCancel} />
          </>
        ) : (
          <Button label="Annuler" size="sm" variant="dark" onPress={onCancel} />
        )}
      </View>
    );
  }

  if (phase.name === 'countdown') {
    return (
      <View style={styles.card}>
        <View style={styles.cd} accessibilityLiveRegion="assertive" accessible accessibilityLabel={`Démarrage dans ${n} secondes`}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <LinearGradient colors={gradients.logo} style={styles.cdN} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text weight="extrabold" size={24} tabular>
                {n}
              </Text>
            </LinearGradient>
          </Animated.View>
          <View style={styles.flex}>
            <Text weight="extrabold">Tout est prêt</Text>
            <Text size={13.5} color={colors.textSoft}>
              {phase.plan.settings.dryRun ? 'Essai à blanc : rien ne sera liké. ' : ''}L’écran va être verrouillé. Ne touchez plus le
              téléphone.
            </Text>
          </View>
        </View>
        <Button label="Annuler" size="sm" variant="dark" onPress={onCancel} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lh: { lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  checks: { gap: 9 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 26 },
  chkIc: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chkOk: { backgroundColor: colors.success, borderColor: colors.success },
  chkKo: { backgroundColor: '#FF5A6E', borderColor: '#FF5A6E' },
  fail: { padding: 12, borderRadius: 14, backgroundColor: colors.dangerBg },
  cd: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceAlt },
  cdN: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
