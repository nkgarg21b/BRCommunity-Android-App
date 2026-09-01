import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useColors } from '@/hooks/useColors';
import { WEBVIEW_BOOTSTRAP, WEBVIEW_ENABLE_AUDIO, isAllowedManagedNavigation, normalizeManagedUrl, platformForUrl } from '@/lib/brcommunity';
import { ManagedItem } from '@/context/ManagerContext';
import { AppIcon } from '@/components/AppIcon';
import { WebMediaPreview } from '@/components/WebMediaPreview';

type Props = {
  item: ManagedItem;
  onClose: (localId: string) => void;
  soundEnabled: boolean;
  soundRequest: number;
  onEnableSound: () => void;
  incognito: boolean;
};

export function BrowserCard({ item, onClose, soundEnabled, soundRequest, onEnableSound, incognito }: Props) {
  const colors = useColors();
  const ref = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const safeUrl = useMemo(() => normalizeManagedUrl(item.url), [item.url]);
  const platform = useMemo(() => safeUrl ? platformForUrl(safeUrl) : 'other', [safeUrl]);
  const remaining = Math.max(0, Math.ceil((item.closeAt - now) / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const enableSound = () => {
    ref.current?.injectJavaScript(WEBVIEW_ENABLE_AUDIO);
    onEnableSound();
  };

  useEffect(() => {
    if (soundEnabled) ref.current?.injectJavaScript(WEBVIEW_ENABLE_AUDIO);
  }, [soundEnabled, soundRequest]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.focused ? colors.primary : colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.siteRow}>
          <View style={[styles.siteIcon, { backgroundColor: platform === 'youtube' ? '#ff4757' : '#9b5de5' }]}>
            <AppIcon family="ionicons" name={platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={15} color={colors.primaryForeground} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.title || (platform === 'youtube' ? 'YouTube content' : 'Instagram Reel')}
            </Text>
            <Text style={[styles.cardUrl, { color: colors.mutedForeground }]} numberOfLines={1}>{item.url}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {item.focused ? <View style={[styles.focusPill, { backgroundColor: colors.primary }]}><Text style={[styles.focusText, { color: colors.primaryForeground }]}>FOCUS</Text></View> : null}
          <View style={[styles.timerPill, { backgroundColor: remaining <= 5 ? colors.accent : colors.muted }]}>
            <AppIcon family="feather" name="clock" size={12} color={remaining <= 5 ? colors.accentForeground : colors.primary} />
            <Text style={[styles.timerText, { color: remaining <= 5 ? colors.accentForeground : colors.primary }]}>{remaining}s</Text>
          </View>
          <Pressable accessibilityLabel="Close browser card" testID={`close-${item.localId}`} onPress={() => onClose(item.localId)} style={styles.closeButton}>
            <AppIcon family="ionicons" name="close" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.browserSurface, { backgroundColor: '#060b13' }]}>
        {Platform.OS === 'web' ? (
          <WebMediaPreview url={item.url} title={item.title || 'Managed media'} soundEnabled={soundEnabled} soundRequest={soundRequest} onEnableSound={onEnableSound} />
        ) : (
          <WebView
            ref={ref}
            source={{ uri: safeUrl || 'about:blank' }}
            onShouldStartLoadWithRequest={(request) => {
              const allowed = Boolean(safeUrl) && isAllowedManagedNavigation(request.url, safeUrl);
              if (!allowed) {
                console.warn('[BRCommunity] Blocked WebView navigation:', request.url);
              }
              return allowed;
            }}
            onLoadEnd={() => {
              setLoaded(true);
              if (soundEnabled) ref.current?.injectJavaScript(WEBVIEW_ENABLE_AUDIO);
            }}
            onMessage={() => {
              // Page messages are ignored. In-app WebView does not perform engagement.
            }}
            injectedJavaScript={WEBVIEW_BOOTSTRAP}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
             incognito={incognito}
            originWhitelist={['https://*']}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            mixedContentMode="never"
            javaScriptCanOpenWindowsAutomatically={false}
            startInLoadingState
            style={styles.webView}
          />
        )}
        {!loaded && Platform.OS !== 'web' ? <View style={styles.loadingOverlay}><Text style={styles.loadingText}>Loading content…</Text></View> : null}
        {!soundEnabled && Platform.OS !== 'web' ? (
          <Pressable onPress={enableSound} style={[styles.soundButton, { backgroundColor: colors.primary }]}>
            <AppIcon family="ionicons" name="volume-high" size={16} color={colors.primaryForeground} />
            <Text style={[styles.soundText, { color: colors.primaryForeground }]}>Enable sound</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.liveLabel}><View style={[styles.liveDot, { backgroundColor: colors.primary }]} /><Text style={[styles.liveText, { color: colors.mutedForeground }]}>{item.focused ? 'Active surface' : 'Managed in app'}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', flex: 1, minWidth: 0 },
  cardHeader: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  siteIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  cardUrl: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  focusPill: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 4 },
  focusText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.7 },
  timerPill: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  closeButton: { padding: 4 },
  browserSurface: { height: 190 },
  webView: { flex: 1, backgroundColor: '#060b13' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#060b13' },
  loadingText: { color: '#8ea2b8', fontFamily: 'Inter_500Medium', fontSize: 12 },
  soundButton: { position: 'absolute', left: 12, bottom: 12, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  soundText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  cardFooter: { minHeight: 39, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 99 },
  liveText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
});
