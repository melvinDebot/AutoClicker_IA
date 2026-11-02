import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../components';
import { colors, HIT } from '../theme';

/** Bottom sheet of the prototype (grab, centred title, "Fermer"). */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]} accessibilityViewIsModal>
          <View style={styles.grab} />
          <View style={styles.head}>
            <View style={styles.side} />
            <Text weight="bold" size={17} style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.side, styles.right]}>
              <Text weight="bold" color={colors.accent}>
                Fermer
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
  },
  grab: { width: 38, height: 5, borderRadius: 3, backgroundColor: colors.switchOff, alignSelf: 'center', marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  side: { minWidth: 70, minHeight: HIT, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  body: { paddingTop: 8, gap: 12 },
});
