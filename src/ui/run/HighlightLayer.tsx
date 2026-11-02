import { StyleSheet, View } from 'react-native';

import type { Highlight } from '@/engine/ports';
import { Text } from '../components';
import { colors } from '../theme';

const TONE = {
  target: { border: colors.accent, bg: 'rgba(169,156,255,0.18)', tag: colors.primary },
  dry: { border: colors.warning, bg: 'rgba(245,184,61,0.22)', tag: '#B9800F' },
  done: { border: colors.success, bg: 'rgba(52,211,153,0.20)', tag: '#14855E' },
} as const;

/** What the engine is about to touch (or would touch, in dry run), drawn over the WebView. */
export function HighlightLayer({ h }: { h: Highlight }) {
  if (!h) return null;
  const t = TONE[h.tone];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.box,
          { left: h.box.x - 3, top: h.box.y - 3, width: h.box.w + 6, height: h.box.h + 6, borderColor: t.border, backgroundColor: t.bg },
        ]}
      >
        {h.label ? (
          <Text size={11} weight="bold" numberOfLines={1} style={[styles.tag, { backgroundColor: t.tag }]}>
            {h.label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 2.5, borderRadius: 10 },
  tag: { position: 'absolute', top: -20, left: -2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden', lineHeight: 18 },
});
