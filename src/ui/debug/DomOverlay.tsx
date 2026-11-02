import { StyleSheet, View } from 'react-native';

import type { DumpElement } from '@/recognition/debugScripts';
import { Text } from '../components';

/** Boxes found in the DOM, drawn over the WebView (debug screen). Never intercepts touches. */
export function DomOverlay({ elements, selectedId }: { elements: DumpElement[]; selectedId: string | null }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      {elements
        .filter((e) => e.visible)
        .map((e) => {
          const sel = e.id === selectedId;
          return (
            <View
              key={e.id}
              style={[
                styles.box,
                { left: e.box.x, top: e.box.y, width: e.box.w, height: e.box.h },
                sel ? styles.selected : e.label ? styles.labelled : styles.plain,
              ]}
            >
              {sel || (e.label && e.box.w > 40) ? (
                <Text size={9} weight="bold" color="#FFFFFF" numberOfLines={1} style={[styles.tag, sel && styles.tagSel]}>
                  {e.label ?? e.role ?? e.tag}
                </Text>
              ) : null}
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 1 },
  plain: { borderColor: 'rgba(99,82,245,0.35)' },
  labelled: { borderColor: 'rgba(99,82,245,0.9)' },
  selected: { borderColor: '#FF4D6D', borderWidth: 2, backgroundColor: 'rgba(255,77,109,0.12)' },
  tag: {
    position: 'absolute',
    top: -1,
    left: -1,
    backgroundColor: 'rgba(99,82,245,0.9)',
    paddingHorizontal: 3,
    lineHeight: 12,
    maxWidth: 160,
  },
  tagSel: { backgroundColor: '#FF4D6D' },
});
