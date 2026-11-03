import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RowTag } from '@/engine/ports';
import { Text } from '../components';
import { colors } from '../theme';
import { placeRowTag, TAG_H } from './rowTagLayout';

const TONE = {
  next: { bg: colors.primary, fg: '#FFFFFF' },
  todo: { bg: 'rgba(99,82,245,0.85)', fg: '#FFFFFF' },
  done: { bg: '#14855E', fg: '#FFFFFF' },
  skipped: { bg: 'rgba(58,58,60,0.9)', fg: '#FFFFFF' },
  error: { bg: colors.danger, fg: '#FFFFFF' },
} as const;

/** "Traité / À traiter / Suivant" next to each visible row during a run (prototype row tags). */
export function RowTagsLayer({ tags }: { tags: RowTag[] | null }) {
  // Width of the WebView: tags never go past its right edge.
  const [width, setWidth] = useState(0);
  if (!tags?.length) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0
        ? tags.map((t, i) => {
            const tone = TONE[t.tone];
            return (
              <View key={i} style={[styles.tag, placeRowTag(t, width), { backgroundColor: tone.bg }]}>
                <Text size={10.5} weight="bold" color={tone.fg} numberOfLines={1}>
                  {t.label}
                </Text>
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { position: 'absolute', height: TAG_H, paddingHorizontal: 7, borderRadius: TAG_H / 2, justifyContent: 'center' },
});
