import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { ManagedItem } from '@/context/ManagerContext';
import { platformForUrl } from '@/lib/brcommunity';
import { AppIcon } from '@/components/AppIcon';

type Props = {
  item: ManagedItem;
  onEngage: (localId: string) => void;
  onClose: (localId: string) => void;
};

export function ChromeTabCard({ item, onEngage, onClose }: Props) {
  const colors = useColors();
  const [now, setNow] = useState(Date.now());
  const platform = platformForUrl(item.url);
  const remaining = Math.max(0, Math.ceil((item.closeAt - now) / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.focused ? colors.primary : colors.border }]}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={[styles.siteIcon, { backgroundColor: platform === 'youtube' ? '#ff4757' : '#9b5de5' }]}>
            <AppIcon family="ionicons" name={platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={15} color={colors.primaryForeground} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{item.title || (platform === 'youtube' ? 'YouTube content' : 'Instagram Reel')}</Text>
            <Text style={[styles.url, { color: colors.mutedForeground }]} numberOfLines={1}>{item.url}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {item.focused ? <View style={[styles.focusPill, { backgroundColor: colors.primary }]}><Text style={[styles.focusText, { color: colors.primaryForeground }]}>FOCUS</Text></View> : null}
          <View style={[styles.timerPill, { backgroundColor: remaining <= 5 ? colors.accent : colors.muted }]}>
            <AppIcon family="feather" name="clock" size={12} color={remaining <= 5 ? colors.accentForeground : colors.primary} />
            <Text style={[styles.timerText, { color: remaining <= 5 ? colors.accentForeground : colors.primary }]}>{remaining}s</Text>
          </View>
          <Pressable accessibilityLabel="Close Chrome tab" testID={`close-${item.localId}`} onPress={() => onClose(item.localId)} style={styles.closeButton}>
            <AppIcon family="ionicons" name="close" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.surface, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <AppIcon family="material" name="google-chrome" size={30} color={colors.primary} />
        <View style={styles.surfaceCopy}>
          <Text style={[styles.surfaceTitle, { color: colors.foreground }]}>Opened in Google Chrome</Text>
          <Text style={[styles.surfaceText, { color: colors.mutedForeground }]}>This window is controlled through Android accessibility access.</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.liveLabel}><View style={[styles.liveDot, { backgroundColor: colors.primary }]} /><Text style={[styles.liveText, { color: colors.mutedForeground }]}>{item.focused ? 'Active Chrome tab' : 'Managed in Chrome'}</Text></View>
        <Pressable accessibilityLabel="Engage active Chrome tab" testID={`engage-${item.localId}`} onPress={() => onEngage(item.localId)} style={[styles.engageButton, { borderColor: colors.border }]}>
          <AppIcon family="feather" name="heart" size={13} color={colors.accent} />
          <Text style={[styles.engageText, { color: colors.foreground }]}>Engage</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', flex: 1, minWidth: 0 },
  header: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  siteIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  url: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  focusPill: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 4 },
  focusText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.7 },
  timerPill: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  closeButton: { padding: 4 },
  surface: { minHeight: 120, borderTopWidth: 1, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  surfaceCopy: { flex: 1 },
  surfaceTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  surfaceText: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 3 },
  footer: { minHeight: 39, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 99 },
  liveText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  engageButton: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  engageText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});