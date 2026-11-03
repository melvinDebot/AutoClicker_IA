// DEVELOPMENT ONLY (spike): lists what the DOM exposes (role, aria-label, text, box) to record
// the real Instagram labels in French and English, and checks DOM-triggered taps early.
import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WebViewRpc } from '@/adapters/webview/rpc';
import { dumpScript, tapTestScript, type DomDump, type DumpElement, type TapTestResult } from '@/recognition/debugScripts';
import { VisionCheckNative, type Snapshot } from '../../../modules/vision-check';
import { Button, Segmented, Text } from '../components';
import { colors, fonts } from '../theme';

type Props = {
  rpc: WebViewRpc;
  getViewTag: () => number | null;
  dump: DomDump | null;
  onDump: (d: DomDump | null) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  /** Opens the local fake Instagram (simulator tests without touching the account). */
  onFixture: () => void;
};

const describe = (e: DumpElement) =>
  [e.label ? `« ${e.label} »` : null, e.text && e.text !== e.label ? e.text : null, e.href].filter(Boolean).join(' · ');

export function DomDebugPanel({ rpc, getViewTag, dump, onDump, selectedId, onSelect, onClose, onFixture }: Props) {
  const [onlyVisible, setOnlyVisible] = useState<'visible' | 'all'>('visible');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ouvrez une page Instagram puis « Analyser ».');
  const [snap, setSnap] = useState<Snapshot | null>(null);

  const list = useMemo(() => {
    const els = dump?.elements ?? [];
    const f = filter.trim().toLowerCase();
    if (!f) return els;
    return els.filter((e) => `${e.tag} ${e.role ?? ''} ${e.label ?? ''} ${e.text} ${e.href ?? ''}`.toLowerCase().includes(f));
  }, [dump, filter]);
  const selected = dump?.elements.find((e) => e.id === selectedId) ?? null;

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setStatus(`${what} : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const analyse = () =>
    run('Analyse', async () => {
      const d = await rpc.call<DomDump>(dumpScript(onlyVisible === 'visible'), 6000);
      onDump(d);
      onSelect(null);
      setStatus(`${d.elements.length} éléments${d.truncated ? ' (tronqué à 400)' : ''} · viewport ${Math.round(d.viewport.w)}×${Math.round(d.viewport.h)} @${d.viewport.dpr}x`);
    });

  const exportDump = () => {
    if (!dump) return;
    // Read on the Mac in the Metro console. Contains usernames: never commit or share it.
    console.log(`[AC-DUMP] ${JSON.stringify(dump)}`);
    setStatus('Dump envoyé dans la console Metro ([AC-DUMP]).');
  };

  const capture = () =>
    run('Capture', async () => {
      const s = await VisionCheckNative.snapshot(getViewTag());
      setSnap(s);
      setStatus(`Capture ${Math.round(s.width)}×${Math.round(s.height)} pt @${s.scale}x`);
    });

  const closeSnap = () => {
    if (snap) VisionCheckNative.release(snap.uri).catch(() => {});
    setSnap(null);
  };

  const tapTest = () => {
    if (!selected) return;
    Alert.alert(
      'Toucher pour de vrai ?',
      `Ce test envoie un vrai toucher à « ${selected.label ?? selected.text ?? selected.tag} ». Sur Instagram, il peut liker, suivre ou ouvrir quelque chose.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Toucher',
          style: 'destructive',
          onPress: () =>
            run('Toucher', async () => {
              const r = await rpc.call<TapTestResult>(tapTestScript(selected.id), 4000);
              setStatus(
                r.ok
                  ? `Touché ${r.hitTag} · libellé avant « ${r.labelBefore ?? '—'} » → après « ${r.labelAfter ?? '—'} »`
                  : `Pas touché : ${r.reason}${r.hit ? ` (au point : ${r.hit})` : ''}`,
              );
            }),
        },
      ],
    );
  };

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text weight="extrabold" size={16} style={styles.flex} accessibilityRole="header">
          Debug DOM
        </Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.link}>
          <Text weight="bold" color={colors.accent}>
            Fermer
          </Text>
        </Pressable>
      </View>
      <Segmented
        label="Éléments"
        value={onlyVisible}
        onChange={setOnlyVisible}
        options={[
          { value: 'visible', label: 'Visibles' },
          { value: 'all', label: 'Tous' },
        ]}
      />
      <View style={styles.actions}>
        <Button label="Analyser" size="sm" onPress={analyse} disabled={busy} style={styles.flex} />
        <Button label="Capture" size="sm" variant="dark" icon="camera" onPress={capture} disabled={busy} style={styles.flex} />
        <Button label="Exporter" size="sm" variant="dark" onPress={exportDump} disabled={!dump} style={styles.flex} />
      </View>
      <Button label="Liste factice (sans Instagram)" size="sm" variant="dark" icon="grid" onPress={onFixture} />
      <Text size={12.5} color={colors.textSoft} accessibilityLiveRegion="polite">
        {status}
      </Text>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Filtrer (aria-label, texte, lien…)"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel="Filtrer les éléments"
      />
      {selected ? (
        <View style={styles.selected}>
          <Text size={12.5} numberOfLines={2} style={styles.flex}>
            {selected.tag}
            {selected.role ? `[role=${selected.role}]` : ''} {describe(selected)}
          </Text>
          <Button label="Toucher (test)" size="sm" variant="danger" onPress={tapTest} disabled={busy} />
        </View>
      ) : null}
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        style={styles.list}
        renderItem={({ item: e }) => (
          <Pressable
            onPress={() => onSelect(e.id === selectedId ? null : e.id)}
            style={[styles.row, e.id === selectedId && styles.rowSel]}
            accessibilityRole="button"
            accessibilityState={{ selected: e.id === selectedId }}
          >
            <Text size={12} weight="bold" color={e.visible ? colors.accent : colors.textFaint} style={styles.mono}>
              {e.tag}
              {e.role ? ` [${e.role}]` : ''}
            </Text>
            <Text size={12.5} numberOfLines={2}>
              {describe(e) || '—'}
            </Text>
            <Text size={11} color={colors.textFaint} style={styles.mono}>
              {Math.round(e.box.x)},{Math.round(e.box.y)} {Math.round(e.box.w)}×{Math.round(e.box.h)}
            </Text>
          </Pressable>
        )}
      />
      <SnapshotModal snap={snap} dump={dump} onClose={closeSnap} />
    </View>
  );
}

/** Shows the native snapshot with the DOM boxes on top, to check that both coordinate spaces match. */
function SnapshotModal({ snap, dump, onClose }: { snap: Snapshot | null; dump: DomDump | null; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!snap) return null;
  const k = Math.min(1, (width - 32) / snap.width);
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.head}>
          <Text weight="extrabold" size={16} style={styles.flex}>
            Capture native + boîtes DOM
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.link}>
            <Text weight="bold" color={colors.accent}>
              Fermer
            </Text>
          </Pressable>
        </View>
        <Text size={12.5} color={colors.textSoft}>
          Capture {Math.round(snap.width)}×{Math.round(snap.height)} pt · viewport DOM{' '}
          {dump ? `${Math.round(dump.viewport.w)}×${Math.round(dump.viewport.h)}` : '—'} · les cadres doivent tomber sur les
          éléments.
        </Text>
        <View style={{ width: snap.width * k, height: snap.height * k, alignSelf: 'center' }}>
          <Image source={{ uri: snap.uri }} style={StyleSheet.absoluteFill} accessibilityLabel="Capture de la WebView" />
          {(dump?.elements ?? [])
            .filter((e) => e.visible && e.label)
            .map((e) => (
              <View
                key={e.id}
                pointerEvents="none"
                style={[styles.snapBox, { left: e.box.x * k, top: e.box.y * k, width: e.box.w * k, height: e.box.h * k }]}
              />
            ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mono: { fontFamily: fonts.medium },
  panel: {
    flex: 1,
    backgroundColor: colors.sheet,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 12,
    gap: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  link: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  input: {
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.inset,
    color: colors.text,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { flex: 1 },
  row: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, gap: 1 },
  rowSel: { backgroundColor: 'rgba(255,77,109,0.12)' },
  modal: { flex: 1, backgroundColor: colors.sheet, padding: 16, gap: 10 },
  snapBox: { position: 'absolute', borderWidth: 1, borderColor: '#FF4D6D' },
});
