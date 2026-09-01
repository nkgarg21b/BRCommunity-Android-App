import React, { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrowserCard } from '@/components/BrowserCard';
import { ChromeTabCard } from '@/components/ChromeTabCard';
import { ContentType, Scope } from '@/lib/brcommunity';
import { BrowserMode, ManagedItem } from '@/context/ManagerContext';
import { useColors } from '@/hooks/useColors';
import { useManager } from '@/context/ManagerContext';
import { AppIcon } from '@/components/AppIcon';

const TYPES: { value: ContentType; label: string; icon: string; family: 'ionicons' | 'feather' }[] = [
  { value: 'reel', label: 'Reels', icon: 'logo-instagram', family: 'ionicons' },
  { value: 'shorts', label: 'Shorts', icon: 'logo-youtube', family: 'ionicons' },
  { value: 'video', label: 'Videos', icon: 'play-circle', family: 'ionicons' },
  { value: 'channel', label: 'Channels', icon: 'users', family: 'feather' },
];

type Section = 'overview' | 'sessions' | 'activity';

function Logo({ small = false }: { small?: boolean }) {
  const colors = useColors();
  return (
    <View style={[small ? styles.logoSmall : styles.logo, { backgroundColor: colors.primary }]}>
      <Text style={[small ? styles.logoSmallText : styles.logoText, { color: colors.primaryForeground }]}>B</Text>
    </View>
  );
}

function StatusDot({ status }: { status: 'good' | 'warn' | 'bad' }) {
  const colors = useColors();
  return <View style={[styles.statusDot, { backgroundColor: status === 'good' ? colors.primary : status === 'warn' ? colors.accent : colors.destructive }]} />;
}

function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signInWithCredentials, authError, authLoading } = useManager();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    try { await signInWithCredentials(email.trim(), password); } catch { /* rendered by context */ } finally { setBusy(false); }
  };
  return (
    <View style={[styles.loginScreen, { backgroundColor: colors.background, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 }]}> 
      <View style={styles.loginGlow} />
      <View style={styles.loginBrand}>
        <Logo />
        <Text style={[styles.brandName, { color: colors.foreground }]}>BRCommunity</Text>
        <Text style={[styles.brandKicker, { color: colors.primary }]}>ANDROID HELPER</Text>
      </View>
      <View style={[styles.loginCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <Text style={[styles.loginTitle, { color: colors.foreground }]}>Sign in to your helper</Text>
        <Text style={[styles.loginSubtitle, { color: colors.mutedForeground }]}>Manage your discovery session, Chrome access and active windows from one place.</Text>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PASSWORD</Text>
        <TextInput secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} onSubmitEditing={() => void submit()} />
        {authError ? <View style={[styles.inlineError, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}55` }]}><AppIcon family="feather" name="alert-circle" size={15} color={colors.destructive} /><Text style={[styles.inlineErrorText, { color: colors.destructive }]}>{authError}</Text></View> : null}
        <Pressable onPress={() => { Keyboard.dismiss(); void submit(); }} disabled={busy || authLoading} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed || busy ? 0.72 : 1 }]}>
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          <AppIcon family="feather" name="arrow-right" size={17} color={colors.primaryForeground} />
        </Pressable>
        <Text style={[styles.loginFootnote, { color: colors.mutedForeground }]}>Use the same credentials as your BRCommunity account.</Text>
      </View>
      <Text style={[styles.version, { color: colors.mutedForeground }]}>BRCommunity Helper · Android</Text>
    </View>
  );
}

function Chip({ active, label, icon, family, onPress, disabled }: { active: boolean; label: string; icon: string; family: 'ionicons' | 'feather'; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border, opacity: disabled ? 0.48 : pressed ? 0.75 : 1 }]}>
      <AppIcon family={family} name={icon} size={16} color={active ? colors.primaryForeground : colors.mutedForeground} />
      <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ value, label, icon }: { value: string | number; label: string; icon: string }) {
  const colors = useColors();
  return <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.metricIcon, { backgroundColor: colors.muted }]}><AppIcon family="feather" name={icon} size={15} color={colors.primary} /></View><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

function HealthRow({ label, value, status }: { label: string; value: string; status: 'good' | 'warn' | 'bad' }) {
  const colors = useColors();
  return <View style={[styles.healthRow, { borderBottomColor: colors.border }]}><View style={styles.healthLeft}><StatusDot status={status} /><Text style={[styles.healthLabel, { color: colors.foreground }]}>{label}</Text></View><Text style={[styles.healthValue, { color: status === 'bad' ? colors.destructive : status === 'warn' ? colors.accent : colors.mutedForeground }]}>{value}</Text></View>;
}

function SettingRow({ label, value, onPress, icon }: { label: string; value: string; onPress?: () => void; icon?: string }) {
  const colors = useColors();
  return <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.settingItem, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}><View style={styles.settingItemLeft}>{icon ? <AppIcon family="feather" name={icon} size={17} color={colors.mutedForeground} /> : null}<Text style={[styles.settingItemLabel, { color: colors.foreground }]}>{label}</Text></View><View style={styles.settingItemRight}><Text style={[styles.settingItemValue, { color: colors.mutedForeground }]}>{value}</Text>{onPress ? <AppIcon family="feather" name="chevron-right" size={17} color={colors.mutedForeground} /> : null}</View></Pressable>;
}

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { type, scope, max, browserMode, soundEnabled, config, chromeControl, setType, setScope, setMax, setBrowserMode, setSoundEnabled, refreshChromeStatus, openChromeAccessibilitySettings, signOutAccount } = useManager();
  const [busy, setBusy] = useState(false);
  const refresh = async () => { setBusy(true); try { await refreshChromeStatus(); } finally { setBusy(false); } };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={[styles.modalBackdrop, { backgroundColor: '#00000099' }]}>
      <View style={[styles.settingsSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>SETTINGS</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Manager configuration</Text></View><Pressable onPress={onClose} style={styles.closeCircle}><AppIcon family="ionicons" name="close" size={20} color={colors.mutedForeground} /></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>CONTENT</Text>
          <View style={styles.sheetChips}>{TYPES.map((x) => <Chip key={x.value} active={type === x.value} label={x.label} icon={x.icon} family={x.family} onPress={() => setType(x.value)} disabled={false} />)}</View>
          <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>SCOPE</Text>
          <View style={[styles.segmented, { backgroundColor: colors.muted, borderColor: colors.border }]}><Pressable onPress={() => setScope('community')} style={[styles.segment, scope === 'community' && { backgroundColor: colors.primary }]}><Text style={[styles.segmentText, { color: scope === 'community' ? colors.primaryForeground : colors.mutedForeground }]}>Community</Text></Pressable><Pressable onPress={() => setScope('own')} style={[styles.segment, scope === 'own' && { backgroundColor: colors.primary }]}><Text style={[styles.segmentText, { color: scope === 'own' ? colors.primaryForeground : colors.mutedForeground }]}>My content</Text></Pressable></View>
          <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>BROWSER</Text>
          <View style={[styles.segmented, { backgroundColor: colors.muted, borderColor: colors.border }]}><Pressable onPress={() => setBrowserMode('in-app')} style={[styles.segment, browserMode === 'in-app' && { backgroundColor: colors.primary }]}><Text style={[styles.segmentText, { color: browserMode === 'in-app' ? colors.primaryForeground : colors.mutedForeground }]}>In-app</Text></Pressable><Pressable onPress={() => setBrowserMode('chrome')} style={[styles.segment, browserMode === 'chrome' && { backgroundColor: colors.primary }]}><Text style={[styles.segmentText, { color: browserMode === 'chrome' ? colors.primaryForeground : colors.mutedForeground }]}>Chrome</Text></Pressable></View>
          <SettingRow label="Max active windows" value={String(max)} icon="layers" onPress={() => setMax(max >= 50 ? 1 : max + 1)} />
          <SettingRow label="Open interval" value={`${config?.open_interval ?? '—'}s`} icon="clock" />
          <SettingRow label="Auto close" value={config ? `${config.auto_close_min}–${config.auto_close_max}s` : '—'} icon="log-out" />
          <SettingRow label="Open mode" value={config?.open_mode === 'incognito' ? 'Incognito' : 'Normal'} icon="shield" />
          <SettingRow label="Auto open" value={config?.auto_open === false ? 'Off' : 'On'} icon="zap" />
          <SettingRow label="Sound" value={soundEnabled ? 'Enabled' : 'Off'} icon="volume-2" onPress={() => setSoundEnabled(!soundEnabled)} />
          {browserMode === 'chrome' ? <>
            <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>ANDROID ACCESS</Text>
            <SettingRow label="Chrome accessibility" value={chromeControl.enabled ? 'Enabled' : 'Required'} icon="unlock" onPress={() => void openChromeAccessibilitySettings()} />
            <SettingRow label="Refresh status" value={busy ? 'Checking…' : chromeControl.enabled ? 'Ready' : 'Check now'} icon="refresh-cw" onPress={() => void refresh()} />
          </> : null}
          <Pressable onPress={() => { onClose(); Alert.alert('Sign out', 'Sign out of this helper on this device?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOutAccount() }]); }} style={[styles.signOutButton, { borderColor: colors.destructive }]}><AppIcon family="feather" name="log-out" size={16} color={colors.destructive} /><Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text></Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<Section>('overview');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chromeBusy, setChromeBusy] = useState(false);
  const {
    user, status, type, scope, max, config, queue, items, activity, sessionOpened, soundEnabled, soundRequest, browserMode, chromeControl, lastError, lastHeartbeatAt,
    setType, setScope, setMax, setSoundEnabled, setBrowserMode, start, stop, engage, removeExpired, refreshActivity, refreshChromeStatus, openChromeAccessibilitySettings,
  } = useManager();
  const isRunning = status === 'RUNNING' || status === 'STARTING';
  const apiOnline = !!lastHeartbeatAt && Date.now() - lastHeartbeatAt < 90_000;
  const healthStatus: 'good' | 'warn' | 'bad' = status === 'ERROR' ? 'bad' : apiOnline || status === 'RUNNING' ? 'good' : 'warn';
  const columns = width >= 760 && config?.layout === 'grid' ? 2 : 1;
  const gridItems = useMemo(() => items.reduce<ManagedItem[][]>((rows, item, index) => { if (index % columns === 0) rows.push([]); rows[rows.length - 1].push(item); return rows; }, []), [columns, items]);
  const startManager = async () => { try { await start(); } catch (error) { Alert.alert('Could not start manager', error instanceof Error ? error.message : 'Please try again.'); } };
  const refresh = async () => { setRefreshing(true); try { await Promise.all([refreshActivity(), refreshChromeStatus()]); } finally { setRefreshing(false); } };
  const enableChrome = async () => { if (chromeBusy) return; setChromeBusy(true); try { if (Platform.OS !== 'android') { Alert.alert('Android build required', 'Chrome control requires the custom native Android build.'); return; } await openChromeAccessibilitySettings(); } catch (error) { Alert.alert('Unable to open settings', error instanceof Error ? error.message : 'Open Accessibility settings manually.'); } finally { setChromeBusy(false); } };

  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.topIdentity}><Logo small /><View><Text style={[styles.topName, { color: colors.foreground }]}>BRCommunity</Text><Text style={[styles.topSubtitle, { color: colors.mutedForeground }]}>Android Helper</Text></View></View>
      <View style={styles.topActions}><View style={[styles.connectionPill, { backgroundColor: colors.muted }]}><StatusDot status={healthStatus} /><Text style={[styles.connectionText, { color: healthStatus === 'bad' ? colors.destructive : colors.primary }]}>{healthStatus === 'good' ? 'ONLINE' : healthStatus === 'warn' ? 'READY' : 'ERROR'}</Text></View><Pressable accessibilityLabel="Open settings" onPress={() => setSettingsVisible(true)} style={styles.topIcon}><AppIcon family="feather" name="settings" size={19} color={colors.mutedForeground} /></Pressable></View>
    </View>

    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />} contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}>
      <View style={styles.hero}><View style={{ flex: 1 }}><Text style={[styles.heroEyebrow, { color: colors.primary }]}>CONTROL CENTER</Text><Text style={[styles.heroTitle, { color: colors.foreground }]}>Good to see you{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.</Text><Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>Your helper is ready to manage the next discovery cycle.</Text></View><View style={[styles.statusBadge, { backgroundColor: status === 'RUNNING' ? colors.primary : colors.muted }]}><StatusDot status={status === 'ERROR' ? 'bad' : status === 'RUNNING' ? 'good' : 'warn'} /><Text style={[styles.statusBadgeText, { color: status === 'RUNNING' ? colors.primaryForeground : colors.mutedForeground }]}>{status}</Text></View></View>

      {lastError ? <View style={[styles.errorBanner, { backgroundColor: `${colors.destructive}12`, borderColor: `${colors.destructive}55` }]}><AppIcon family="feather" name="alert-triangle" size={17} color={colors.destructive} /><Text style={[styles.errorBannerText, { color: colors.destructive }]} numberOfLines={3}>{lastError}</Text></View> : null}

      {browserMode === 'chrome' && !chromeControl.enabled ? <View style={[styles.accessCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.accessIcon, { backgroundColor: colors.muted }]}><AppIcon family="material" name="google-chrome" size={23} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.accessTitle, { color: colors.foreground }]}>Chrome access required</Text><Text style={[styles.accessText, { color: colors.mutedForeground }]}>Enable Android accessibility access so the native controller can verify and manage Chrome sessions.</Text><Pressable onPress={() => void enableChrome()} style={[styles.accessButton, { backgroundColor: colors.primary }]}><Text style={[styles.accessButtonText, { color: colors.primaryForeground }]}>{chromeBusy ? 'Opening…' : 'Open Accessibility'}</Text></Pressable></View></View> : null}

      <View style={styles.sectionTabs}><Pressable onPress={() => setSection('overview')} style={[styles.sectionTab, section === 'overview' && { borderBottomColor: colors.primary }]}><AppIcon family="feather" name="activity" size={16} color={section === 'overview' ? colors.primary : colors.mutedForeground} /><Text style={[styles.sectionTabText, { color: section === 'overview' ? colors.primary : colors.mutedForeground }]}>Overview</Text></Pressable><Pressable onPress={() => setSection('sessions')} style={[styles.sectionTab, section === 'sessions' && { borderBottomColor: colors.primary }]}><AppIcon family="feather" name="layers" size={16} color={section === 'sessions' ? colors.primary : colors.mutedForeground} /><Text style={[styles.sectionTabText, { color: section === 'sessions' ? colors.primary : colors.mutedForeground }]}>Sessions</Text><View style={[styles.countBadge, { backgroundColor: colors.muted }]}><Text style={[styles.countBadgeText, { color: colors.mutedForeground }]}>{items.length}</Text></View></Pressable><Pressable onPress={() => setSection('activity')} style={[styles.sectionTab, section === 'activity' && { borderBottomColor: colors.primary }]}><AppIcon family="feather" name="list" size={16} color={section === 'activity' ? colors.primary : colors.mutedForeground} /><Text style={[styles.sectionTabText, { color: section === 'activity' ? colors.primary : colors.mutedForeground }]}>Activity</Text></Pressable></View>

      {section === 'overview' ? <>
        <View style={styles.sectionBlock}><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONTENT TYPE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{TYPES.map((x) => <Chip key={x.value} active={type === x.value} label={x.label} icon={x.icon} family={x.family} onPress={() => setType(x.value)} disabled={isRunning} />)}</ScrollView></View>
        <View style={styles.controlRow}><View style={{ flex: 1 }}><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SCOPE</Text><View style={[styles.segmented, { backgroundColor: colors.muted, borderColor: colors.border }]}><Pressable disabled={isRunning} onPress={() => setScope('community')} style={[styles.segment, scope === 'community' && { backgroundColor: colors.primary }]}><Text style={[styles.segmentText, { color: scope === 'community' ? colors.primaryForeground : colors.mutedForeground }]}>Community</Text></Pressable><Pressable disabled={isRunning} onPress={() => setScope('own')} style={[styles.segment, scope === 'own' && { backgroundColor: colors.primary }]}><Text style={[styles.segmentText, { color: scope === 'own' ? colors.primaryForeground : colors.mutedForeground }]}>My content</Text></Pressable></View></View><View style={{ width: 118 }}><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MAX WINDOWS</Text><View style={[styles.stepper, { backgroundColor: colors.card, borderColor: colors.border }]}><Pressable disabled={isRunning} onPress={() => setMax(max - 1)} style={styles.stepButton}><AppIcon family="feather" name="minus" size={15} color={colors.mutedForeground} /></Pressable><Text style={[styles.stepValue, { color: colors.foreground }]}>{max}</Text><Pressable disabled={isRunning} onPress={() => setMax(max + 1)} style={styles.stepButton}><AppIcon family="feather" name="plus" size={15} color={colors.mutedForeground} /></Pressable></View></View></View>
        <View style={styles.actionRow}><Pressable onPress={() => void startManager()} disabled={isRunning} style={({ pressed }) => [styles.startButton, { backgroundColor: colors.primary, opacity: isRunning ? 0.45 : pressed ? 0.75 : 1 }]}><AppIcon family="feather" name="play" size={16} color={colors.primaryForeground} /><Text style={[styles.startText, { color: colors.primaryForeground }]}>{status === 'STARTING' ? 'Starting…' : 'Start manager'}</Text></Pressable><Pressable onPress={() => void stop()} disabled={!isRunning} style={({ pressed }) => [styles.stopButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: !isRunning ? 0.4 : pressed ? 0.7 : 1 }]}><AppIcon family="feather" name="square" size={14} color={colors.destructive} /><Text style={[styles.stopText, { color: colors.foreground }]}>Stop</Text></Pressable></View>
        <View style={styles.metricRow}><Metric value={items.length} label="ACTIVE" icon="layers" /><Metric value={queue.length} label="QUEUED" icon="list" /><Metric value={sessionOpened} label="OPENED" icon="external-link" /></View>
        <View style={styles.sectionHeader}><View><Text style={[styles.sectionLabel, { color: colors.primary }]}>SYSTEM HEALTH</Text><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Everything in one view</Text></View><Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{config?.open_interval ?? '—'}s interval</Text></View>
        <View style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}><HealthRow label="Manager" value={status} status={status === 'ERROR' ? 'bad' : status === 'RUNNING' ? 'good' : 'warn'} /><HealthRow label="API heartbeat" value={apiOnline ? 'Online' : 'Waiting'} status={apiOnline ? 'good' : 'warn'} /><HealthRow label="Chrome controller" value={browserMode === 'chrome' ? (chromeControl.enabled ? 'Ready' : 'Access required') : 'Not used'} status={browserMode === 'in-app' ? 'good' : chromeControl.enabled ? 'good' : 'warn'} /><HealthRow label="Scheduler" value={isRunning ? 'Active' : 'Idle'} status={isRunning ? 'good' : 'warn'} /></View>
      </> : null}

      {section === 'sessions' ? <View style={styles.sessionSection}><View style={styles.sessionHeader}><View><Text style={[styles.sectionLabel, { color: colors.primary }]}>LIVE SURFACE</Text><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Managed sessions</Text></View><Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>{items.length} active</Text></View>{items.length ? <View style={[styles.browserGrid, config?.layout === 'stack' && styles.browserStack]}>{gridItems.map((row, rowIndex) => <View key={`row-${rowIndex}`} style={styles.browserRow}>{row.map((item) => browserMode === 'chrome' ? <ChromeTabCard key={item.localId} item={item} onEngage={engage} onClose={removeExpired} /> : <BrowserCard key={item.localId} item={item} onEngage={engage} onClose={removeExpired} soundEnabled={soundEnabled} soundRequest={soundRequest} onEnableSound={() => setSoundEnabled(true)} incognito={config?.open_mode === 'incognito'} />)}</View>)}</View> : <View style={[styles.emptySurface, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}><AppIcon family="feather" name="layers" size={22} color={colors.primary} /></View><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isRunning ? 'Opening the next session…' : 'No active sessions'}</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{isRunning ? 'New discovery links will appear here as the manager progresses.' : 'Start the manager to create controlled browser sessions.'}</Text></View>}</View> : null}

      {section === 'activity' ? <View style={styles.activitySection}><View style={styles.sessionHeader}><View><Text style={[styles.sectionLabel, { color: colors.primary }]}>AUDIT TRAIL</Text><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent activity</Text></View><Pressable onPress={() => void refreshActivity()}><AppIcon family="feather" name="refresh-cw" size={17} color={colors.mutedForeground} /></Pressable></View><View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>{activity.length ? activity.slice(0, 40).map((entry, index) => <View key={entry.id} style={[styles.activityItem, { borderBottomColor: colors.border, borderBottomWidth: index === activity.length - 1 ? 0 : 1 }]}><View style={[styles.activityIcon, { backgroundColor: entry.ok ? `${colors.primary}18` : `${colors.destructive}18` }]}><AppIcon family="feather" name={entry.ok ? 'check' : 'x'} size={13} color={entry.ok ? colors.primary : colors.destructive} /></View><View style={{ flex: 1 }}><Text style={[styles.activityMessage, { color: colors.foreground }]} numberOfLines={2}>{entry.message}</Text><Text style={[styles.activityTime, { color: colors.mutedForeground }]}>{new Date(entry.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text></View></View>) : <View style={styles.activityEmpty}><AppIcon family="feather" name="clock" size={21} color={colors.mutedForeground} /><Text style={[styles.noActivity, { color: colors.mutedForeground }]}>No recent activity</Text></View>}</View></View> : null}
    </ScrollView>
    <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}><Pressable onPress={() => setSection('overview')} style={styles.bottomItem}><AppIcon family="feather" name="activity" size={21} color={section === 'overview' ? colors.primary : colors.mutedForeground} /><Text style={[styles.bottomLabel, { color: section === 'overview' ? colors.primary : colors.mutedForeground }]}>Overview</Text></Pressable><Pressable onPress={() => setSection('sessions')} style={styles.bottomItem}><View><AppIcon family="feather" name="layers" size={21} color={section === 'sessions' ? colors.primary : colors.mutedForeground} />{items.length > 0 ? <View style={[styles.bottomBadge, { backgroundColor: colors.primary }]} /> : null}</View><Text style={[styles.bottomLabel, { color: section === 'sessions' ? colors.primary : colors.mutedForeground }]}>Sessions</Text></Pressable><Pressable onPress={() => setSettingsVisible(true)} style={styles.bottomItem}><AppIcon family="feather" name="settings" size={21} color={colors.mutedForeground} /><Text style={[styles.bottomLabel, { color: colors.mutedForeground }]}>Settings</Text></Pressable></View>
    <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
  </View>;
}

export default function Index() {
  const { user, authLoading } = useManager();
  if (authLoading) return <View style={styles.loadingScreen}><Logo /><Text style={[styles.loadingCaption, { color: '#8ea2b8' }]}>Loading helper…</Text></View>;
  return user ? <HomeScreen /> : <LoginScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: '#08111f', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingCaption: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  logo: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  logoText: { fontFamily: 'Inter_700Bold', fontSize: 36, letterSpacing: -3 },
  logoSmall: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoSmallText: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -2 },
  loginScreen: { flex: 1, paddingHorizontal: 22, justifyContent: 'space-between', overflow: 'hidden' },
  loginGlow: { position: 'absolute', width: 340, height: 340, borderRadius: 180, backgroundColor: '#103248', opacity: 0.35, top: -140, right: -110 },
  loginBrand: { alignItems: 'center', gap: 8 },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.8 },
  brandKicker: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 2.3 },
  loginCard: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 11 },
  loginTitle: { fontFamily: 'Inter_700Bold', fontSize: 23, letterSpacing: -0.6 },
  loginSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.3, marginTop: 3 },
  input: { height: 49, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 14 },
  inlineError: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  inlineErrorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  primaryButton: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  loginFootnote: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 2 },
  version: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center' },
  topBar: { minHeight: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  topIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topName: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.3 },
  topSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectionPill: { minHeight: 28, borderRadius: 99, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 99 },
  connectionText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.8 },
  topIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 18, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.7, marginBottom: 5 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.9 },
  heroSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 330 },
  statusBadge: { minHeight: 28, borderRadius: 99, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.7 },
  errorBanner: { marginHorizontal: 18, borderWidth: 1, borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorBannerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  accessCard: { marginHorizontal: 18, marginBottom: 4, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12 },
  accessIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  accessTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  accessText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 4 },
  accessButton: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginTop: 10 },
  accessButtonText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  sectionTabs: { marginHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#233a54', flexDirection: 'row', gap: 4, marginTop: 4 },
  sectionTab: { minHeight: 46, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sectionTabText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  sectionBlock: { paddingHorizontal: 18, paddingTop: 18 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4, marginBottom: 8 },
  chipRow: { gap: 8, paddingBottom: 2 },
  chip: { minHeight: 43, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  controlRow: { paddingHorizontal: 18, paddingTop: 17, flexDirection: 'row', gap: 12 },
  segmented: { borderRadius: 12, borderWidth: 1, padding: 3, flexDirection: 'row' },
  segment: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  stepper: { minHeight: 40, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { paddingHorizontal: 10, paddingVertical: 9 },
  stepValue: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  actionRow: { paddingHorizontal: 18, paddingTop: 16, flexDirection: 'row', gap: 9 },
  startButton: { flex: 1, height: 49, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  startText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  stopButton: { width: 86, height: 49, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  stopText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  metricRow: { paddingHorizontal: 18, paddingTop: 14, flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 92, borderRadius: 16, borderWidth: 1, padding: 11 },
  metricIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.5 },
  metricLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1.1, marginTop: 2 },
  sectionHeader: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.5 },
  sectionMeta: { fontFamily: 'Inter_500Medium', fontSize: 10, paddingBottom: 2 },
  healthCard: { marginHorizontal: 18, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
  healthRow: { minHeight: 47, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  healthLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  healthLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  healthValue: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  sessionSection: { paddingTop: 2 },
  sessionHeader: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 11, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  browserGrid: { paddingHorizontal: 18, gap: 10 },
  browserStack: { gap: 10 },
  browserRow: { flexDirection: 'row', gap: 10 },
  emptySurface: { marginHorizontal: 18, minHeight: 210, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 5, maxWidth: 280 },
  activitySection: { paddingTop: 2 },
  activityCard: { marginHorizontal: 18, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
  activityItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  activityIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityMessage: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  activityTime: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  activityEmpty: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 9 },
  noActivity: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 70, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  bottomItem: { minWidth: 90, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 7 },
  bottomLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  bottomBadge: { position: 'absolute', top: -1, right: -3, width: 7, height: 7, borderRadius: 4 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  settingsSheet: { maxHeight: '88%', borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#50647a', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 3 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.4 },
  closeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#142238' },
  sheetLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.4, marginTop: 17, marginBottom: 8 },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  settingItem: { minHeight: 50, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingItemRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  settingItemLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  settingItemValue: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  signOutButton: { minHeight: 45, borderWidth: 1, borderRadius: 13, marginTop: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
});
