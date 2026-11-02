import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, findNodeHandle, Pressable, StyleSheet, View } from 'react-native';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebViewRpc } from '@/adapters/webview/rpc';
import type { DomDump } from '@/recognition/debugScripts';
import { START_URL } from '@/recognition/rules';
import { parseInstagramUrl, type ParsedUrl } from '@/recognition/url';
import { Button, Text } from '@/ui/components';
import { DomDebugPanel } from '@/ui/debug/DomDebugPanel';
import { DomOverlay } from '@/ui/debug/DomOverlay';
import { WebViewFrame, type InstagramWebView } from '@/ui/home/WebViewFrame';
import { Icon, type IconName } from '@/ui/Icon';
import { colors, gradients, HIT } from '@/ui/theme';

type Nav = { url: string; canGoBack: boolean; loading: boolean };

function caption(p: ParsedUrl): { text: string; ok: boolean; icon: IconName } {
  switch (p.kind) {
    case 'login':
    case 'account_check':
      return { text: 'Connectez-vous dans la WebView, puis ouvrez une liste d’abonnés.', ok: false, icon: 'info' };
    case 'followers':
      return { text: `Liste d’abonnés de @${p.username} ouverte`, ok: true, icon: 'checkCircle' };
    case 'profile':
      return { text: `Touchez « abonnés » pour ouvrir la liste de @${p.username}.`, ok: false, icon: 'info' };
    default:
      return { text: 'Ouvrez la liste des abonnés d’un compte, puis lancez.', ok: false, icon: 'info' };
  }
}

export default function HomeScreen() {
  const webRef = useRef<InstagramWebView>(null);
  const urlRef = useRef(START_URL);
  const [nav, setNav] = useState<Nav>({ url: START_URL, canGoBack: false, loading: true });
  const [full, setFull] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [dump, setDump] = useState<DomDump | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rpc = useMemo(
    () =>
      new WebViewRpc(
        (js) => webRef.current?.injectJavaScript(js),
        () => urlRef.current,
      ),
    [],
  );
  useEffect(() => () => rpc.cancelAll('Écran fermé'), [rpc]);

  const onNavigation = useCallback((n: WebViewNavigation) => {
    urlRef.current = n.url;
    setNav((prev) => ({ ...prev, url: n.url, canGoBack: n.canGoBack }));
  }, []);

  const onLoadStart = useCallback(() => {
    rpc.cancelAll();
    setDump(null);
    setSelectedId(null);
    setNav((prev) => ({ ...prev, loading: true }));
  }, [rpc]);

  const onMessage = useCallback((e: WebViewMessageEvent) => rpc.handleMessage(e.nativeEvent.data), [rpc]);

  const getViewTag = useCallback(() => {
    const node = webRef.current ? findNodeHandle(webRef.current) : null;
    return typeof node === 'number' ? node : null;
  }, []);

  const parsed = parseInstagramUrl(nav.url);
  const cap = caption(parsed);

  const launch = () => {
    // STUB (step 1): the scan, summary, countdown and engine arrive in step 3.
    Alert.alert('Pas encore disponible', 'Le scan et le moteur arrivent à l’étape 3. Cette version sert au spike WebView.');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {!full ? (
        <View style={styles.top}>
          <LinearGradient colors={gradients.logo} style={styles.appIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Icon name="logo" size={18} />
          </LinearGradient>
          <Text weight="extrabold" size={19} style={styles.flex} accessibilityRole="header">
            AutoClicker
          </Text>
          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={debugOpen ? 'Fermer le debug DOM' : 'Ouvrir le debug DOM'}
              onPress={() => setDebugOpen((v) => !v)}
              style={[styles.iconBtn, debugOpen && styles.iconBtnOn]}
            >
              <Icon name="bug" size={20} color={debugOpen ? colors.text : colors.accent} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.frameWrap, debugOpen && styles.frameWrapDebug]}>
        <WebViewFrame
          ref={webRef}
          url={nav.url}
          canGoBack={nav.canGoBack}
          loading={nav.loading}
          full={full}
          onNavigation={onNavigation}
          onLoadStart={onLoadStart}
          onLoadEnd={() => setNav((prev) => ({ ...prev, loading: false }))}
          onMessage={onMessage}
          onBack={() => webRef.current?.goBack()}
          onReload={() => webRef.current?.reload()}
          onToggleFull={() => setFull((v) => !v)}
          overlay={debugOpen && dump ? <DomOverlay elements={dump.elements} selectedId={selectedId} /> : null}
        />
      </View>

      {debugOpen ? (
        <View style={styles.debug}>
          <DomDebugPanel
            rpc={rpc}
            getViewTag={getViewTag}
            dump={dump}
            onDump={setDump}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onClose={() => setDebugOpen(false)}
          />
        </View>
      ) : (
        <View style={styles.dock}>
          {!full ? (
            <View style={styles.cap} accessible accessibilityLabel={cap.text}>
              <Icon name={cap.icon} size={16} color={cap.ok ? colors.successText : colors.textMuted} />
              <Text
                size={13.5}
                weight={cap.ok ? 'bold' : 'regular'}
                color={cap.ok ? colors.successText : colors.textMuted}
                style={styles.capText}
              >
                {cap.text}
              </Text>
            </View>
          ) : null}
          <Button label="Lancer" size="xl" icon="play" iconFill onPress={launch} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  appIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: HIT, height: HIT, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBtnOn: { backgroundColor: colors.primary },
  frameWrap: { flex: 1, paddingHorizontal: 12 },
  frameWrapDebug: { flex: 1.1 },
  debug: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  dock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  cap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  capText: { textAlign: 'center', flexShrink: 1 },
});
