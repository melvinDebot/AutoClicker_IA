import { StyleSheet, View } from 'react-native';

import type { RowTag } from '@/engine/ports';
import { Text } from '../components';
import { colors } from '../theme';

const TONE = {
  next: { bg: colors.primary, fg: '#FFFFFF' },
  todo: { bg: 'rgba(99,82,245,0.85)', fg: '#FFFFFF' },
  done: { bg: '#14855E', fg: '#FFFFFF' },
  skipped: { bg: 'rgba(58,58,60,0.9)', fg: '#FFFFFF' },
  error: { bg: colors.danger, fg: '#FFFFFF' },
} as const;

/** "Traité / À traiter / Suivant" next to each visible row during a run (prototype row tags). */
export function RowTagsLayer({ tags }: { tags: RowTag[] | null }) {
  if (!tags?.length) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      {tags.map((t, i) => {
        const tone = TONE[t.tone];
        return (
          <View key={i} style={[styles.tag, { left: t.box.x + t.box.w + 6, top: t.box.y, backgroundColor: tone.bg }]}>
            <Text size={10.5} weight="bold" color={tone.fg} numberOfLines={1}>
              {t.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { position: 'absolute', height: 18, paddingHorizontal: 7, borderRadius: 9, justifyContent: 'center' },
});
