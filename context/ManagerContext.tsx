import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRecord, isManagerState, parseJson, ManagedItemSchema, LinkItemSchema } from '@/lib/storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  apiJson,
  checkSession,
  ContentType,
  LinkItem,
  normalizeConfig,
  OpenMode,
  platformForUrl,
  normalizeManagedUrl,
  randomCloseSeconds,
  RemoteConfig,
  Scope,
  signIn,
  signOut,
  User,
  resolveOpenMode,
} from '@/lib/brcommunity';
import {
  closeChromeTab,
  clearChromeTabLifecycles,
  beginChromeRuntimeSession,
  touchChromeRuntimeSession,
  cancelChromeTabLifecycle,
  engageChromeTab,
  getChromeControlStatus,
  openChromeAccessibilitySettings,
  openChromeUrl,
  ChromeControlStatus,
  scheduleChromeTabLifecycle,
} from '@/lib/chromeControl';

const STATE_KEY = 'brMobileManagerState';
const ACTIVITY_KEY = 'brMobileActivity';
const MAX_ACTIVITY = 40;

export type ManagedItem = LinkItem & {
  localId: string;
  openedAt: number;
  closeAt: number;
  engageAt: number;
  engagementSent: boolean;
  focused: boolean;
};

export type Activity = { id: string; message: string; ok: boolean; at: number };
type ManagerStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR';
export type BrowserMode = 'in-app' | 'chrome';

type ManagerContextValue = {
  user: User | null;
  authLoading: boolean;
  authError: string;
  status: ManagerStatus;
  type: ContentType;
  scope: Scope;
  max: number;
  config: RemoteConfig | null;
  queue: LinkItem[];
  items: ManagedItem[];
  activity: Activity[];
  sessionOpened: number;
  soundEnabled: boolean;
  soundRequest: number;
  browserMode: BrowserMode;
  chromeControl: ChromeControlStatus;
  lastError: string;
  lastHeartbeatAt: number | null;
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  signOutAccount: () => Promise<void>;
  setType: (type: ContentType) => void;
  setScope: (scope: Scope) => void;
  setMax: (value: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setBrowserMode: (mode: BrowserMode) => void;
  refreshChromeStatus: () => Promise<ChromeControlStatus>;
  openChromeAccessibilitySettings: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  engage: (localId: string) => void;
  removeExpired: (localId: string) => void;
  refreshActivity: () => Promise<void>;
  refreshSession: () => Promise<User | null>;
};

const ManagerContext = createContext<ManagerContextValue | null>(null);

function idFor(link: LinkItem): string {
  return `${String(link.id)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isActivity(value: unknown): value is Activity {
  return isRecord(value) && typeof value.id === 'string' && typeof value.message === 'string' && typeof value.ok === 'boolean' && Number.isFinite(value.at);
}

function isActivityList(value: unknown): value is Activity[] {
  return Array.isArray(value) && value.every(isActivity);
}

async function saveActivityItem(message: string, ok: boolean): Promise<Activity> {
  const item: Activity = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message, ok, at: Date.now() };
  let current: Activity[] = [];
  try {
    current = parseJson(await AsyncStorage.getItem(ACTIVITY_KEY), [], isActivityList);
  } catch {
    current = [];
  }
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify([item, ...current].slice(0, MAX_ACTIVITY)));
  return item;
}

export function ManagerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [status, setStatus] = useState<ManagerStatus>('STOPPED');
  const [type, setTypeState] = useState<ContentType>('reel');
  const [scope, setScopeState] = useState<Scope>('community');
  const [max, setMaxState] = useState(12);
  const [config, setConfig] = useState<RemoteConfig | null>(null);
  const [queue, setQueue] = useState<LinkItem[]>([]);
  const [items, setItems] = useState<ManagedItem[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [sessionOpened, setSessionOpened] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [soundRequest, setSoundRequest] = useState(0);
  const [browserMode, setBrowserModeState] = useState<BrowserMode>('in-app');
  const [chromeControl, setChromeControl] = useState<ChromeControlStatus>({ supported: false, enabled: false, chromeInstalled: false });
  const [lastError, setLastError] = useState('');
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const sessionId = useRef<string | null>(null);
  const globalStopVersion = useRef(0);
  const focusIndex = useRef(0);
  const statusRef = useRef<ManagerStatus>(status);
  const typeRef = useRef(type);
  const scopeRef = useRef(scope);
  const maxRef = useRef(max);
  const configRef = useRef(config);
  const queueRef = useRef(queue);
  const itemsRef = useRef(items);
  const closeTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openInProgressRef = useRef(false);
  const lifecycleMutationRef = useRef<Promise<void>>(Promise.resolve());
  const persistWriteRef = useRef<Promise<void>>(Promise.resolve());
  const activityWriteRef = useRef<Promise<void>>(Promise.resolve());
  const itemMutationRef = useRef(new Map<string, Promise<void>>());
  const managerGenerationRef = useRef(0);
  const queueReservationRef = useRef<{ generation: number; linkId: string | number } | null>(null);
  const nextOpenAtRef = useRef<number | null>(null);
  const openNextRef = useRef<() => Promise<void>>(async () => {});
  const openModeRef = useRef<OpenMode>('normal');
  const hydratedRef = useRef(false);
  const restoredRunningRef = useRef(false);
  const sessionOpenedRef = useRef(sessionOpened);
  const lastErrorRef = useRef(lastError);
  const lastHeartbeatAtRef = useRef<number | null>(lastHeartbeatAt);
  const soundEnabledRef = useRef(soundEnabled);
  const browserModeRef = useRef<BrowserMode>(browserMode);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { sessionOpenedRef.current = sessionOpened; }, [sessionOpened]);
  useEffect(() => { lastErrorRef.current = lastError; }, [lastError]);
  useEffect(() => { lastHeartbeatAtRef.current = lastHeartbeatAt; }, [lastHeartbeatAt]);
  useEffect(() => { typeRef.current = type; }, [type]);
  useEffect(() => { scopeRef.current = scope; }, [scope]);
  useEffect(() => { maxRef.current = max; }, [max]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { browserModeRef.current = browserMode; }, [browserMode]);

  const record = useCallback(async (message: string, ok = true) => {
    const previous = activityWriteRef.current;
    const next = previous.catch(() => {}).then(async () => saveActivityItem(message, ok));
    activityWriteRef.current = next.then(() => undefined, () => undefined);
    const item = await next;
    setActivity((current) => [item, ...current].slice(0, MAX_ACTIVITY));
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      setActivity(parseJson(await AsyncStorage.getItem(ACTIVITY_KEY), [], isActivityList));
    } catch {
      setActivity([]);
    }
  }, []);

  const persist = useCallback(async (nextItems = itemsRef.current) => {
    const snapshot = JSON.stringify({
      status: statusRef.current === 'STARTING' ? 'RUNNING' : statusRef.current === 'STOPPING' ? 'STOPPED' : statusRef.current,
      type: typeRef.current,
      scope: scopeRef.current,
      max: maxRef.current,
      config: configRef.current,
      queue: queueRef.current,
      items: nextItems,
      sessionOpened: sessionOpenedRef.current,
      lastError: lastErrorRef.current,
      sessionId: sessionId.current,
      globalStopVersion: globalStopVersion.current,
      lastHeartbeatAt: lastHeartbeatAtRef.current,
      soundEnabled: soundEnabledRef.current,
      browserMode: browserModeRef.current,
      openMode: openModeRef.current,
      nextOpenAt: nextOpenAtRef.current,
    });
    const previous = persistWriteRef.current;
    const next = previous.catch(() => {}).then(() => AsyncStorage.setItem(STATE_KEY, snapshot));
    persistWriteRef.current = next.then(() => undefined, () => undefined);
    await next;
  }, []);

  const refreshSession = useCallback(async (): Promise<User | null> => {
    let existing: User | null = null;
    try {
      existing = await checkSession();
      setUser(existing);
      setAuthError('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to verify your BRCommunity session.');
    } finally {
      setAuthLoading(false);
    }
    return existing;
  }, []);

  useEffect(() => {
    void (async () => {
      let rawStored: unknown = {};
      try { rawStored = JSON.parse((await AsyncStorage.getItem(STATE_KEY)) || '{}'); } catch { rawStored = {}; }
      const stored = isRecord(rawStored) ? rawStored as Record<string, unknown> : {};
      const safeItems = Array.isArray(stored.items) ? stored.items.filter((item) => ManagedItemSchema.safeParse(item).success) as ManagedItem[] : [];
      const safeQueue = Array.isArray(stored.queue) ? stored.queue.filter((item) => LinkItemSchema.safeParse(item).success) as LinkItem[] : [];
      if (stored.type === 'reel' || stored.type === 'shorts' || stored.type === 'video' || stored.type === 'channel') setTypeState(stored.type);
      if (stored.scope === 'community' || stored.scope === 'own') setScopeState(stored.scope);
      if (Number.isFinite(stored.max)) setMaxState(Math.min(100, Math.max(1, Math.round(stored.max))));
      if (stored.config) {
        configRef.current = stored.config;
        setConfig(stored.config);
      }
      if (safeQueue.length) {
        queueRef.current = safeQueue;
        setQueue(safeQueue);
      }
      const now = Date.now();
      const restoredItems = safeItems.filter((item) => item.closeAt > now);
      if (stored.items) {
        itemsRef.current = restoredItems;
        setItems(restoredItems);
        const expiredItems = safeItems.filter((item) => item.closeAt <= now);
        if (stored.browserMode === 'chrome') {
          await Promise.all(expiredItems.map((item) => closeChromeTab(item.localId, item.url).catch(() => {})));
        }
      }
      if (stored.sessionOpened) {
        sessionOpenedRef.current = stored.sessionOpened;
        setSessionOpened(stored.sessionOpened);
      }
      if (stored.soundEnabled) {
        setSoundEnabledState(true);
        soundEnabledRef.current = true;
      }
      if (stored.browserMode === 'chrome' || stored.browserMode === 'in-app') {
        setBrowserModeState(stored.browserMode);
        browserModeRef.current = stored.browserMode;
      }
      if (stored.openMode === 'incognito' || stored.openMode === 'normal') {
        openModeRef.current = stored.openMode;
      }
      if (stored.lastError) {
        lastErrorRef.current = stored.lastError;
        setLastError(stored.lastError);
      }
      globalStopVersion.current = stored.globalStopVersion || 0;
      lastHeartbeatAtRef.current = stored.lastHeartbeatAt || null;
      setLastHeartbeatAt(stored.lastHeartbeatAt || null);
      nextOpenAtRef.current = Number(stored.nextOpenAt) > 0 ? Number(stored.nextOpenAt) : null;
      // A persisted RUNNING session belongs to a previous JS process and is stale.
      // Never resurrect it automatically: its queue lock, timers and native Chrome
      // lifecycles may no longer correspond to the currently visible UI.
      restoredRunningRef.current = false;
      if (stored.status === 'RUNNING' || stored.sessionId) {
        sessionId.current = null;
        nextOpenAtRef.current = null;
        managerGenerationRef.current += 1;
        if (stored.browserMode === 'chrome') {
          await clearChromeTabLifecycles().catch(() => {});
        }
        statusRef.current = 'STOPPED';
        setStatus('STOPPED');
      }
      await refreshActivity();
      await refreshSession();
      if (stored.status === 'RUNNING' || stored.sessionId) {
        await persist(restoredItems);
      }
      hydratedRef.current = true;
    })();
  }, [persist, refreshActivity, refreshSession]);

  const signInWithCredentials = useCallback(async (email: string, password: string) => {
    setAuthError('');
    try {
      const signedIn = await signIn(email.trim(), password);
      setUser(signedIn);
      await record('Signed in to BRCommunity');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      setAuthError(message);
      throw error;
    }
  }, [record]);

  const signOutAccount = useCallback(async () => {
    await stop();
    await signOut();
    setUser(null);
    setAuthError('');
    await record('Signed out');
  }, [record]);

  const setType = useCallback((value: ContentType) => {
    if (status === 'RUNNING') return;
    setTypeState(value);
    setConfig(null);
  }, [status]);
  const setScope = useCallback((value: Scope) => {
    if (status === 'RUNNING') return;
    setScopeState(value);
  }, [status]);
  const setMax = useCallback((value: number) => setMaxState(Math.min(50, Math.max(1, Math.round(value || 1)))), []);
  const setSoundEnabled = useCallback((enabled: boolean) => {
    soundEnabledRef.current = enabled;
    setSoundEnabledState(enabled);
    if (enabled) setSoundRequest((request) => request + 1);
    void persist();
  }, [persist]);

  const refreshChromeStatus = useCallback(async () => {
    let next: ChromeControlStatus;
    try {
      next = await getChromeControlStatus();
    } catch {
      next = Platform.OS === 'android'
        ? { supported: true, enabled: false, chromeInstalled: false }
        : { supported: false, enabled: false, chromeInstalled: false };
    }
    setChromeControl(next);
    return next;
  }, []);

  const setBrowserMode = useCallback((mode: BrowserMode) => {
    if (status === 'RUNNING' || status === 'STARTING') return;
    browserModeRef.current = mode;
    setBrowserModeState(mode);
    void persist();
    if (mode === 'chrome') void refreshChromeStatus();
  }, [persist, refreshChromeStatus, status]);

  useEffect(() => {
    void refreshChromeStatus();
  }, [refreshChromeStatus]);

  const loadQueue = useCallback(async (nextType: ContentType, nextScope: Scope, nextMax: number) => {
    const data = await apiJson<{ links?: LinkItem[] }>(`/discover?type=${encodeURIComponent(nextType)}&limit=${Math.min(nextMax, 100)}&scope=${nextScope}`);
    const links = (Array.isArray(data.links) ? data.links : [])
      .map((link) => {
        if (!link?.url) return null;
        const normalizedUrl = normalizeManagedUrl(link.url);
        if (!normalizedUrl || platformForUrl(normalizedUrl) === 'other') return null;
        return { ...link, url: normalizedUrl };
      })
      .filter((link): link is LinkItem => Boolean(link));
    if (!links.length) throw new Error(nextScope === 'own' ? 'No active links of this type in your account.' : 'No community links available right now.');
    return links;
  }, []);

  const getOpenIntervalMs = useCallback(() => {
    const configured = Number(configRef.current?.open_interval);
    if (!Number.isFinite(configured)) return 5000;
    return Math.min(24 * 60 * 60 * 1000, Math.max(1000, Math.round(configured * 1000)));
  }, []);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    nextOpenAtRef.current = null;
  }, []);

  const scheduleNextOpen = useCallback(() => {
    if (statusRef.current !== 'RUNNING' || !configRef.current || configRef.current.auto_open === false) {
      clearOpenTimer();
      return;
    }
    const intervalMs = getOpenIntervalMs();
    let target = nextOpenAtRef.current;
    if (!target || !Number.isFinite(target)) target = Date.now() + intervalMs;

    // When max capacity is reached, wake at the earliest expected close rather
    // than spinning every open_interval while the queue is full.
    if (itemsRef.current.length >= maxRef.current) {
      const earliestClose = itemsRef.current.reduce((min, item) => Math.min(min, item.closeAt), Number.POSITIVE_INFINITY);
      if (Number.isFinite(earliestClose)) target = Math.max(Date.now() + 250, Math.min(target, earliestClose));
    }

    nextOpenAtRef.current = target;
    clearTimeout(openTimerRef.current as ReturnType<typeof setTimeout> | undefined);
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      void openNextRef.current();
    }, Math.max(0, target - Date.now()));
  }, [clearOpenTimer, getOpenIntervalMs]);

  const heartbeat = useCallback(async (nextStatus: 'running' | 'stopped') => {
    if (!sessionId.current) return;
    const data = await apiJson<{ global_stop_version?: number }>('/extension/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId.current,
        status: nextStatus,
        global_stop_version: globalStopVersion.current,
        desktop_fingerprint: `android-${Platform.OS}`,
      }),
    });
    if (Number(data.global_stop_version || 0) > globalStopVersion.current && nextStatus === 'running') {
      globalStopVersion.current = Number(data.global_stop_version);
      await record('Global emergency stop received');
      await stop();
    }
    if (nextStatus === 'running' && browserModeRef.current === 'chrome' && sessionId.current) {
      await touchChromeRuntimeSession(sessionId.current).catch(() => {});
    }
    const heartbeatAt = Date.now();
    lastHeartbeatAtRef.current = heartbeatAt;
    setLastHeartbeatAt(heartbeatAt);
  }, [record]);

  const enqueueLifecycleMutation = useCallback((operation: () => Promise<void>) => {
    const previous = lifecycleMutationRef.current;
    const next = previous.catch(() => {}).then(operation);
    lifecycleMutationRef.current = next.catch(() => {});
    return next;
  }, []);

  const performOpenNext = useCallback(async () => {
    const generation = managerGenerationRef.current;
    if (statusRef.current !== 'RUNNING' || !configRef.current || configRef.current.auto_open === false || openInProgressRef.current) return;
    if (itemsRef.current.length >= maxRef.current) {
      scheduleNextOpen();
      return;
    }

    openInProgressRef.current = true;
    queueReservationRef.current = null;
    let reservedLink: LinkItem | null = null;
    let openedInChrome = false;
    let localId = '';
    try {
      let currentQueue = queueRef.current;
      if (!currentQueue.length) {
        currentQueue = await loadQueue(typeRef.current, scopeRef.current, maxRef.current);
        if (generation !== managerGenerationRef.current || statusRef.current !== 'RUNNING') return;
        queueRef.current = currentQueue;
        setQueue(currentQueue);
      }

      reservedLink = currentQueue[0] || null;
      if (!reservedLink) return;
      const normalizedReservedUrl = normalizeManagedUrl(reservedLink.url);
      if (!normalizedReservedUrl) {
        await record('Refused unsafe discovery URL', false);
        return;
      }
      reservedLink = { ...reservedLink, url: normalizedReservedUrl };
      queueReservationRef.current = { generation, linkId: reservedLink.id };
      localId = idFor(reservedLink);
      const launchMode = browserModeRef.current;

      // Do not mutate the queue until the browser launch has succeeded. A failed
      // launch therefore cannot silently consume a discovery link.
      if (launchMode === 'chrome') {
        await openChromeUrl(reservedLink.url, localId, openModeRef.current === 'incognito');
        openedInChrome = true;
      }

      if (generation !== managerGenerationRef.current || statusRef.current !== 'RUNNING') {
        if (openedInChrome) {
          await closeChromeTab(localId, reservedLink.url).catch(() => {});
          await cancelChromeTabLifecycle(localId).catch(() => {});
        }
        return;
      }

      const now = Date.now();
      const closeSeconds = randomCloseSeconds(configRef.current);
      const openedAt = now;
      const closeAt = openedAt + Math.max(1000, Math.round(closeSeconds * 1000));
      const item: ManagedItem = {
        ...reservedLink,
        localId,
        openedAt,
        closeAt,
        engageAt: Math.max(openedAt, closeAt - 3000),
        engagementSent: false,
        focused: itemsRef.current.length === 0,
      };

      // Arm native lifecycle before committing the queue item. If native scheduling
      // fails, the queue entry remains available and the just-opened Chrome tab is
      // cleaned up instead of becoming an unmanaged orphan.
      if (launchMode === 'chrome') {
        await scheduleChromeTabLifecycle(localId, reservedLink.url, closeAt, item.engageAt);
      }

      // Commit the queue dequeue atomically with a fully armed browser session.
      const latestQueue = queueRef.current;
      if (generation !== managerGenerationRef.current || latestQueue[0]?.id !== reservedLink.id) {
        if (openedInChrome) {
          await cancelChromeTabLifecycle(localId).catch(() => {});
          await closeChromeTab(localId, reservedLink.url).catch(() => {});
        }
        return;
      }
      const remaining = latestQueue.slice(1);
      queueRef.current = remaining;
      setQueue(remaining);

      const nextItems = [...itemsRef.current, item];
      itemsRef.current = nextItems;
      setItems(nextItems);
      if (nextItems.length === 1) focusIndex.current = 1;
      sessionOpenedRef.current += 1;
      setSessionOpened(sessionOpenedRef.current);

      try {
        await apiJson('/discover/click', {
          method: 'POST',
          body: JSON.stringify({ link_id: reservedLink.id, scope: scopeRef.current, own_mode: scopeRef.current === 'own' ? 1 : 0 }),
        });
      } catch {
        // Telemetry failure does not invalidate a successfully opened item.
      }
      await record(`Window opened · auto-closes in ${closeSeconds}s`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the next link.';
      lastErrorRef.current = message;
      setLastError(message);
      await record(message, false);
      // reservedLink remains in queue because dequeue is committed only after launch.
      if (openedInChrome && localId && reservedLink) {
        await closeChromeTab(localId, reservedLink.url).catch(() => {});
        await cancelChromeTabLifecycle(localId).catch(() => {});
      }
    } finally {
      queueReservationRef.current = null;
      openInProgressRef.current = false;
      if (generation === managerGenerationRef.current && statusRef.current === 'RUNNING' && configRef.current?.auto_open !== false) {
        // The interval starts from the successful open, not from an arbitrary timer
        // callback or API latency, making open_interval deterministic.
        if (reservedLink && itemsRef.current.some((item) => item.localId === localId)) {
          nextOpenAtRef.current = Date.now() + getOpenIntervalMs();
        } else if (!nextOpenAtRef.current) {
          nextOpenAtRef.current = Date.now() + getOpenIntervalMs();
        }
        scheduleNextOpen();
        await persist(itemsRef.current);
      }
    }
  }, [getOpenIntervalMs, loadQueue, persist, record, scheduleNextOpen]);

  const stopRemoteSession = useCallback(async (remoteSessionId: string, stopVersion = globalStopVersion.current) => {
    if (!remoteSessionId) return;
    await apiJson('/extension/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        session_id: remoteSessionId,
        status: 'stopped',
        global_stop_version: stopVersion,
        desktop_fingerprint: `android-${Date.now()}`,
      }),
    });
  }, []);

  const openNext = useCallback(async () => {
    if (openInProgressRef.current) return;
    return enqueueLifecycleMutation(async () => {
      if (openInProgressRef.current) return;
      await performOpenNext();
    });
  }, [enqueueLifecycleMutation, performOpenNext]);

  useEffect(() => {
    openNextRef.current = openNext;
  }, [openNext]);

  const engage = useCallback(async (localId: string) => {
    const previous = itemMutationRef.current.get(localId) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const item = itemsRef.current.find((candidate) => candidate.localId === localId);
      if (!item || item.engagementSent || Date.now() >= item.closeAt || statusRef.current !== 'RUNNING') return;
      let accepted = true;
      if (browserModeRef.current === 'chrome') {
        accepted = await engageChromeTab(localId, item.url).catch(() => false);
      }
      if (!accepted) {
        await record(`Engagement refused · stale or unverified Chrome session`, false);
        return;
      }
      const current = itemsRef.current.find((candidate) => candidate.localId === localId);
      if (!current || current.engagementSent || Date.now() >= current.closeAt) return;
      const next = itemsRef.current.map((candidate) => candidate.localId === localId ? { ...candidate, engagementSent: true } : candidate);
      itemsRef.current = next;
      setItems(next);
      await persist(next);
      await record(`Engagement attempt: ${platformForUrl(item.url)}`);
    });
    const chain = operation.then(() => undefined, () => undefined);
    itemMutationRef.current.set(localId, chain);
    try { await operation; } finally {
      if (itemMutationRef.current.get(localId) === chain) itemMutationRef.current.delete(localId);
    }
  }, [persist, record]);

  const removeExpired = useCallback(async (localId: string) => {
    const previous = itemMutationRef.current.get(localId) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const item = itemsRef.current.find((candidate) => candidate.localId === localId);
      if (!item) return;
      if (browserModeRef.current === 'chrome') {
        const closed = await closeChromeTab(localId, item.url).catch(() => false);
        if (closed) await cancelChromeTabLifecycle(localId).catch(() => {});
      }
      const closeTimer = closeTimersRef.current.get(localId);
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimersRef.current.delete(localId);
      }
      const next = itemsRef.current.filter((candidate) => candidate.localId !== localId);
      itemsRef.current = next;
      setItems(next);
      await record('Window closed');
      await persist(next);
    });
    const chain = operation.then(() => undefined, () => undefined);
    itemMutationRef.current.set(localId, chain);
    try { await operation; } finally {
      if (itemMutationRef.current.get(localId) === chain) itemMutationRef.current.delete(localId);
    }
  }, [persist, record]);

  useEffect(() => {
    if (status !== 'RUNNING') {
      clearOpenTimer();
      for (const timer of closeTimersRef.current.values()) clearTimeout(timer);
      closeTimersRef.current.clear();
      return;
    }

    const activeIds = new Set(items.map((item) => item.localId));
    for (const [localId, timer] of closeTimersRef.current) {
      if (!activeIds.has(localId)) {
        clearTimeout(timer);
        closeTimersRef.current.delete(localId);
      }
    }

    for (const item of items) {
      // Chrome lifecycle timing is owned by the native scheduler. JS keeps only
      // a best-effort UI reconciliation timer and never issues the close.
      if (browserModeRef.current === 'chrome') continue;
      if (closeTimersRef.current.has(item.localId)) continue;
      const schedule = () => {
        const current = itemsRef.current.find((candidate) => candidate.localId === item.localId);
        if (!current) {
          closeTimersRef.current.delete(item.localId);
          return;
        }
        const remaining = current.closeAt - Date.now();
        if (remaining > 0) {
          const retry = setTimeout(schedule, remaining);
          closeTimersRef.current.set(item.localId, retry);
          return;
        }
        closeTimersRef.current.delete(item.localId);
        removeExpired(item.localId);
      };
      const timer = setTimeout(schedule, Math.max(0, item.closeAt - Date.now()));
      closeTimersRef.current.set(item.localId, timer);
    }
  }, [clearOpenTimer, items, removeExpired, status]);

  useEffect(() => () => {
    managerGenerationRef.current += 1;
    openInProgressRef.current = false;
    queueReservationRef.current = null;
    clearOpenTimer();
    for (const timer of closeTimersRef.current.values()) clearTimeout(timer);
    closeTimersRef.current.clear();
  }, [clearOpenTimer]);

  const start = useCallback(async () => {
    if (!user) throw new Error('Sign in is required.');
    if (statusRef.current === 'RUNNING' || statusRef.current === 'STARTING' || statusRef.current === 'STOPPING') return;
    managerGenerationRef.current += 1;
    const generation = managerGenerationRef.current;
    queueReservationRef.current = null;
    statusRef.current = 'STARTING';
    setStatus('STARTING');
    lastErrorRef.current = '';
    setLastError('');
    try {
      if (browserModeRef.current === 'chrome') {
        const chrome = await refreshChromeStatus();
        if (!chrome.supported) throw new Error('Chrome control requires the custom native Android build; it is not available in Expo Go or the web preview.');
        if (!chrome.chromeInstalled) throw new Error('Google Chrome is not installed on this Android device.');
        if (!chrome.enabled) throw new Error('Enable BRCommunity Chrome control in Android Accessibility settings, then try again.');
      }
       const cfgData = await apiJson<{ settings?: Partial<RemoteConfig>; open_modes?: { type?: string; community?: string; own?: string } }>(`/extension/config?type=${encodeURIComponent(typeRef.current)}`);
       const normalizedConfig = normalizeConfig(cfgData.settings, typeRef.current);
       const resolvedOpenMode = resolveOpenMode(normalizedConfig, cfgData.open_modes, scopeRef.current);
       const nextConfig: RemoteConfig = { ...normalizedConfig, open_mode: resolvedOpenMode };
      setConfig(nextConfig);
      configRef.current = nextConfig;
       openModeRef.current = resolvedOpenMode;
      const session = await apiJson<{ session_id?: string; global_stop_version?: number }>('/extension/session', {
        method: 'POST',
        body: JSON.stringify({ type: typeRef.current, status: 'running', desktop_fingerprint: `android-${Date.now()}` }),
      });
      if (!session.session_id) throw new Error('BRCommunity did not return a session id.');
      if (generation !== managerGenerationRef.current || statusRef.current !== 'STARTING') {
        await stopRemoteSession(session.session_id, Number(session.global_stop_version || 0)).catch(() => {});
        return;
      }
      sessionId.current = session.session_id;
      globalStopVersion.current = Number(session.global_stop_version || 0);
      if (browserModeRef.current === 'chrome') {
        // Native owns critical Chrome engagement/close timing. The runtime lease
        // prevents stale alarms from a previous JS process from acting.
        await beginChromeRuntimeSession(session.session_id);
        if (generation !== managerGenerationRef.current || statusRef.current !== 'STARTING') return;
      }
      const links = await loadQueue(typeRef.current, scopeRef.current, maxRef.current);
      if (generation !== managerGenerationRef.current || statusRef.current !== 'STARTING') return;
      setQueue(links);
      queueRef.current = links;
      setItems([]);
      itemsRef.current = [];
       focusIndex.current = 0;
       sessionOpenedRef.current = 0;
       setSessionOpened(0);
       nextOpenAtRef.current = null;
       openInProgressRef.current = false;
       statusRef.current = 'RUNNING';
      setStatus('RUNNING');
      await record(`Manager started · ${typeRef.current}`);
      await persist([]);
      if (generation !== managerGenerationRef.current || statusRef.current !== 'RUNNING') return;
      if (configRef.current.auto_open !== false) {
        nextOpenAtRef.current = Date.now();
        await openNext();
      } else {
        nextOpenAtRef.current = null;
        scheduleNextOpen();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start manager.';
      // A stop/restart may have superseded this start while an API/native call was
      // awaiting. Never let the stale start transition the newer lifecycle to ERROR
      // or clear its session.
      if (generation !== managerGenerationRef.current) return;
      lastErrorRef.current = message;
      setLastError(message);
      statusRef.current = 'ERROR';
      setStatus('ERROR');
      await record(message, false);
      if (browserModeRef.current === 'chrome') {
        await clearChromeTabLifecycles().catch(() => {});
      }
      try { if (sessionId.current) await heartbeat('stopped'); } catch { /* cleanup */ }
      sessionId.current = null;
      throw error;
    }
  }, [heartbeat, loadQueue, openNext, persist, record, refreshChromeStatus, status, stopRemoteSession, user]);

  const stop = useCallback(async () => {
    if (statusRef.current === 'STOPPED' || statusRef.current === 'STOPPING') return;
    managerGenerationRef.current += 1;
    queueReservationRef.current = null;
    statusRef.current = 'STOPPING';
    setStatus('STOPPING');
    clearOpenTimer();
    if (browserModeRef.current === 'chrome') {
      await Promise.all(itemsRef.current.map((item) => closeChromeTab(item.localId, item.url).catch(() => {})));
      await clearChromeTabLifecycles().catch(() => {});
    }
    try { await heartbeat('stopped'); } catch { /* best effort, local stop still wins */ }
    sessionId.current = null;
    setItems([]);
    itemsRef.current = [];
    setQueue([]);
    queueRef.current = [];
    focusIndex.current = 0;
    nextOpenAtRef.current = null;
    openInProgressRef.current = false;
    statusRef.current = 'STOPPED';
    setStatus('STOPPED');
    await record('Manager stopped');
    await persist([]);
  }, [clearOpenTimer, heartbeat, persist, record, status]);

  useEffect(() => {
    if (status !== 'RUNNING') return;
    scheduleNextOpen();
    const interval = setInterval(() => {
      const now = Date.now();
      const current = itemsRef.current;
      if (browserModeRef.current !== 'chrome') {
        for (const item of current) {
          if (!item.engagementSent && now >= item.engageAt && now < item.closeAt) void engage(item.localId);
        }
      }
      const expired = current.filter((item) => now >= item.closeAt);
      if (browserModeRef.current === 'chrome') {
        if (expired.length) {
          const expiredIds = new Set(expired.map((item) => item.localId));
          const next = current.filter((item) => !expiredIds.has(item.localId));
          itemsRef.current = next;
          setItems(next);
          void persist(next);
        }
      } else {
        expired.forEach((item) => void removeExpired(item.localId));
      }
    }, 1000);
    const heartbeatTimer = setInterval(() => void heartbeat('running').catch((error) => {
      const message = error instanceof Error ? error.message : 'Heartbeat failed.';
      lastErrorRef.current = message;
      setLastError(message);
    }), 30000);
    const focusTimer = configRef.current?.cycle_focus_enabled
      ? setInterval(() => {
        const current = itemsRef.current;
        if (!current.length) return;
        const nextIndex = focusIndex.current % current.length;
        focusIndex.current = (nextIndex + 1) % current.length;
        const next = current.map((item, index) => ({ ...item, focused: index === nextIndex }));
        itemsRef.current = next;
        setItems(next);
        void persist(next);
      }, Math.max(3000, (configRef.current.cycle_focus_seconds || 5) * 1000))
      : undefined;
    return () => { clearInterval(interval); clearInterval(heartbeatTimer); if (focusTimer) clearInterval(focusTimer); };
  }, [engage, heartbeat, items, persist, removeExpired, scheduleNextOpen, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void refreshChromeStatus();
        if (status === 'RUNNING') void heartbeat('running').catch(() => {});
        if (status === 'RUNNING') {
          if (browserModeRef.current === 'chrome') {
            for (const item of itemsRef.current) {
              void scheduleChromeTabLifecycle(item.localId, item.url, item.closeAt, item.engageAt).catch(() => {});
            }
          }
          if (nextOpenAtRef.current && nextOpenAtRef.current <= Date.now()) {
            nextOpenAtRef.current = Date.now();
          }
          scheduleNextOpen();
        }
      }
    });
    return () => subscription.remove();
  }, [heartbeat, refreshChromeStatus, scheduleNextOpen, status]);

  const value = useMemo<ManagerContextValue>(() => ({
    user, authLoading, authError, status, type, scope, max, config, queue, items, activity, sessionOpened, soundEnabled, soundRequest, browserMode, chromeControl, lastError, lastHeartbeatAt,
    signInWithCredentials, signOutAccount, setType, setScope, setMax, setSoundEnabled, setBrowserMode, refreshChromeStatus, openChromeAccessibilitySettings, start, stop, engage, removeExpired, refreshActivity, refreshSession,
  }), [activity, authError, authLoading, browserMode, chromeControl, config, engage, items, lastError, lastHeartbeatAt, max, queue, refreshActivity, refreshChromeStatus, refreshSession, scope, sessionOpened, setBrowserMode, setMax, setScope, setSoundEnabled, setType, signInWithCredentials, signOutAccount, soundEnabled, soundRequest, start, status, stop, type, user]);

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export function useManager(): ManagerContextValue {
  const context = useContext(ManagerContext);
  if (!context) throw new Error('useManager must be used inside ManagerProvider');
  return context;
}