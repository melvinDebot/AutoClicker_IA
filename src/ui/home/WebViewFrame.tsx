import { forwardRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { START_URL } from '@/recognition/rules';
import { displayUrl, shouldLoadInWebView } from '@/recognition/url';
import { Text } from '../components';
import { Icon, type IconName } from '../Icon';
import { colors, HIT } from '../theme';

type Props = {
  url: string;
  canGoBack: boolean;
  loading: boolean;
  full: boolean;
  locked?: boolean;
  onNavigation: (nav: WebViewNavigation) => void;
  onLoadStart: () => void;
  onLoadEnd: () => void;
  onMessage: (e: WebViewMessageEvent) => void;
  onBack: () => void;
  onReload: () => void;
  onToggleFull: () => void;
  /** Drawn over the page, same origin as the WebView viewport (debug boxes, highlights). */
  overlay?: ReactNode;
};

function BarButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.barBtn}
    >
      <Icon name={icon} size={20} color={disabled ? colors.textDisabled : colors.accent} />
    </Pressable>
  );
}

/** react-native-webview types `WebView<P = undefined>` as `WebViewProps & undefined` (never): use `object`. */
export type InstagramWebView = WebView<object>;

export const WebViewFrame = forwardRef<InstagramWebView, Props>(function WebViewFrame(p, ref) {
  return (
    <View style={styles.frame} accessibilityLabel="WebView Instagram">
      <View style={styles.bar}>
        <BarButton icon="back" label="Page précédente" onPress={p.onBack} disabled={!p.canGoBack || p.locked} />
        <BarButton icon="refresh" label="Recharger la page" onPress={p.onReload} disabled={p.locked} />
        <View style={styles.addr} accessible accessibilityLabel={`Adresse : ${displayUrl(p.url)}`}>
          <Icon name="lock" size={14} color={colors.textMuted} />
          <Text size={13} color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {displayUrl(p.url)}
          </Text>
        </View>
        <BarButton
          icon={p.full ? 'shrink' : 'expand'}
          label={p.full ? 'Réduire la WebView' : 'Agrandir la WebView'}
          onPress={p.onToggleFull}
          disabled={p.locked}
        />
      </View>
      <View style={styles.viewport}>
        <WebView<object>
          ref={ref}
          source={{ uri: START_URL }}
          style={StyleSheet.absoluteFill}
          // Persistent cookies (default WKWebsiteDataStore): the user signs in once, on Instagram's own page.
          incognito={false}
          // No custom user agent, no global injected script (guardrails).
          onMessage={p.onMessage}
          onNavigationStateChange={p.onNavigation}
          onLoadStart={p.onLoadStart}
          onLoadEnd={p.onLoadEnd}
          onShouldStartLoadWithRequest={(r: ShouldStartLoadRequest) => shouldLoadInWebView(r.url)}
          onContentProcessDidTerminate={() => p.onReload()}
          allowsBackForwardNavigationGestures={!p.locked}
          allowsInlineMediaPlayback
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          // Safari Web Inspector on the Mac, development builds only.
          webviewDebuggingEnabled={__DEV__}
          scrollEnabled={!p.locked}
        />
        {p.overlay}
        {p.loading ? (
          <View style={styles.loading} pointerEvents="none" accessibilityLabel="Chargement">
            <ActivityIndicator color={colors.accentStrong} />
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  frame: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 6 },
  barBtn: { width: HIT, height: HIT, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addr: {
    flex: 1,
    minWidth: 0,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    marginHorizontal: 2,
  },
  viewport: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  loading: { position: 'absolute', top: 10, right: 10 },
});
