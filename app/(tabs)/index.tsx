import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findResumable, getSession } from '@/adapters/store/sessionStore';
import { createPagePort } from '@/adapters/webview/pagePort';
import { WebViewRpc } from '@/adapters/webview/rpc';
import type { Highlight } from '@/engine/ports';
import { dumpScript, type DomDump } from '@/recognition/debugScripts';
import { START_URL } from '@/recognition/rules';
import { parseInstagramUrl, type ParsedUrl } from '@/recognition/url';
import { Button, Text } from '@/ui/components';
import { DomDebugPanel } from '@/ui/debug/DomDebugPanel';
import { DomOverlay } from '@/ui/debug/DomOverlay';
import { WebViewFrame, type InstagramWebView } from '@/ui/home/WebViewFrame';
import { Icon, type IconName } from '@/ui/Icon';
import { HighlightLayer } from '@/ui/run/HighlightLayer';
import { LockedOverlay } from '@/ui/run/LockedOverlay';
import { RecapSheet } from '@/ui/run/RecapSheet';
import { ScanCard } from '@/ui/run/ScanCard';
import { SummarySheet } from '@/ui/run/SummarySheet';
import { useRunner } from '@/ui/run/useRunner';
import { colors, gradients, HIT, TAB_BAR_STYLE } from '@/ui/theme';

type Nav = { url: string; canGoBack: boolean; loading: boolean };
type Resumable = { processed: number; discovered: number } | null;

function caption(p: ParsedUrl, resumable: Resumable): { text: string; ok: boolean; icon: IconName } {
  switch (p.kind) {
    case 'login':
    case 'account_check':
      return { text: 'Connectez-vous dans la WebView, puis ouvrez une liste d’abonnés.', ok: false, icon: 'info' };
    case 'followers':
      return resumable
        ? { text: `Session @${p.username} · reprise possible · ${resumable.discovered} détectés`, ok: true, icon: 'checkCircle' }
        : { text: `Liste d’abonnés de @${p.username} ouverte`, ok: true, icon: 'checkCircle' };
    case 'profile':
      return { text: `Touchez « abonnés » pour ouvrir la liste de @${p.username}.`, ok: false, icon: 'info' };
    default:
      return { text: 'Ouvrez la liste des abonnés d’un compte, puis lancez.', ok: false, icon: 'info' };
  }
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ resume?: string }>();
  const webRef = useRef<InstagramWebView>(null);
  const urlRef = useRef(START_URL);
  const [source, setSource] = useState({ uri: START_URL, key: 0 });
  const [nav, setNav] = useState<Nav>({ url: START_URL, canGoBack: false, loading: true });
  const [full, setFull] = useState(false);
  const [locked, setLocked] = useState(false);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [resumable, setResumable] = useState<Resumable>(null);
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

  // New architecture: the WebView ref is an imperative handle (goBack, injectJavaScript…), not a
  // component, so findNodeHandle throws. The native module finds the app's single WKWebView itself.
  const getViewTag = useCallback((): number | null => null, []);

  const page = useMemo(
    () =>
      createPagePort({
        rpc,
        currentUrl: () => urlRef.current,
        goBack: () => webRef.current?.goBack(),
        onHighlight: setHighlight,
      }),
    [rpc],
  );

  const onLockChange = useCallback(
    (l: boolean) => {
      setLocked(l);
      if (l) setDebugOpen(false);
      navigation.setOptions({ tabBarStyle: l ? { display: 'none' } : TAB_BAR_STYLE });
    },
    [navigation],
  );
  const runner = useRunner({ page, getViewTag, onLockChange });
  const { phase } = runner;

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

  // "Reprendre" from the Sessions tab: open the followers list of that account. The user then
  // launches as usual (scan, summary, countdown): a session never restarts on its own.
  useEffect(() => {
    if (!params.resume) return;
    getSession(params.resume).then((s) => {
      if (s) setSource((prev) => ({ uri: `https://www.instagram.com/${s.targetAccount}/followers/`, key: prev.key + 1 }));
    });
    router.setParams({ resume: undefined });
  }, [params.resume]);

  const parsed = parseInstagramUrl(nav.url);
  useEffect(() => {
    if (parsed.kind !== 'followers' || !parsed.username) {
      setResumable(null);
      return;
    }
    findResumable(parsed.username)
      .then((s) => setResumable(s ? { processed: 0, discovered: s.discoveredCount } : null))
      .catch(() => setResumable(null));
  }, [parsed.kind, parsed.username, phase.name]);

  // DEVELOPMENT ONLY: dumps what the DOM exposes on every page, read on the Mac in the
  // Metro console ([AC-DUMP]) to write the real selectors of rules.ts. Read-only, never on sign-in pages.
  useEffect(() => {
    if (!__DEV__ || nav.loading || locked) return;
    const t = setTimeout(() => {
      rpc
        .call<DomDump>(dumpScript(false), 6000) // off-screen elements too (heart below the fold…)
        .then((d) => console.log(`[AC-DUMP] ${JSON.stringify(d)}`))
        .catch(() => {});
      // Raw HTML of the profile counters (posts / followers), to write their rule.
      rpc
        .call<string>(
          `var m = document.querySelector('main'); if (!m) return '';
           var a = m.querySelector('a[href$="/followers/"]'); var n = a; for (var k = 0; k < 4 && n && n.parentElement; k++) n = n.parentElement;
           return n ? n.outerHTML.replace(/ class="[^"]*"/g, '').slice(0, 2500) : '';`,
          6000,
        )
        .then((h) => h && console.log(`[AC-HTML] ${h}`))
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [nav.url, nav.loading, locked, rpc]);

  const cap = caption(parsed, resumable);
  const busy = phase.name !== 'idle';
  const showFull = full || locked;
  const dockCard = phase.name === 'scanning' || phase.name === 'scan_failed' || phase.name === 'countdown';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {!showFull ? (
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
              disabled={busy}
              style={[styles.iconBtn, debugOpen && styles.iconBtnOn]}
            >
              <Icon name="bug" size={20} color={debugOpen ? colors.text : colors.accent} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.frameWrap, debugOpen && styles.frameWrapDebug, locked && styles.frameLocked]}>
        <WebViewFrame
          key={source.key}
          ref={webRef}
          sourceUrl={source.uri}
          url={nav.url}
          canGoBack={nav.canGoBack}
          loading={nav.loading}
          full={showFull}
          locked={busy}
          onNavigation={onNavigation}
          onLoadStart={onLoadStart}
          onLoadEnd={() => setNav((prev) => ({ ...prev, loading: false }))}
          onMessage={onMessage}
          onBack={() => webRef.current?.goBack()}
          onReload={() => webRef.current?.reload()}
          onToggleFull={() => setFull((v) => !v)}
          overlay={
            <>
              {debugOpen && dump ? <DomOverlay elements={dump.elements} selectedId={selectedId} /> : null}
              {busy ? <HighlightLayer h={highlight} /> : null}
            </>
          }
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
      ) : locked ? null : (
        <View style={styles.dock}>
          {dockCard ? (
            <ScanCard phase={phase} onCancel={runner.cancel} />
          ) : (
            <>
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
              <Button label="Lancer" size="xl" icon="play" iconFill onPress={runner.scan} disabled={busy} />
            </>
          )}
        </View>
      )}

      {phase.name === 'recap' ? <RecapSheet phase={phase} onConfirm={runner.confirm} onCancel={runner.cancel} /> : null}
      <LockedOverlay
        visible={phase.name === 'locked'}
        account={phase.name === 'locked' ? phase.plan.targetAccount : ''}
        progress={runner.progress}
        startedAt={phase.name === 'locked' ? phase.startedAt : Date.now()}
        previousElapsedMs={phase.name === 'locked' ? phase.plan.previousElapsedMs : 0}
        dryRun={phase.name === 'locked' ? phase.plan.settings.dryRun : true}
        onStop={() => runner.stop('manual')}
      />
      {phase.name === 'summary' ? <SummarySheet phase={phase} onClose={runner.close} onResume={runner.scan} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  appIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // In development, Expo's floating dev-menu button sits in the top-right corner: keep clear of it.
  iconBtn: { width: HIT, height: HIT, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: __DEV__ ? 56 : 0 },
  iconBtnOn: { backgroundColor: colors.primary },
  frameWrap: { flex: 1, paddingHorizontal: 12 },
  frameWrapDebug: { flex: 1.1 },
  frameLocked: { paddingHorizontal: 0, paddingBottom: 0 },
  debug: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  dock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  cap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  capText: { textAlign: 'center', flexShrink: 1 },
});
