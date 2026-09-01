import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { captureException, trackEvent } from '@/lib/telemetry';

const configuredApiBase = process.env.EXPO_PUBLIC_BR_API_BASE?.replace(/\/$/, '');
export const API_BASE =
  Platform.OS === 'web'
    ? (configuredApiBase || '/api/brcommunity')
    : (configuredApiBase?.startsWith('https://') ? configuredApiBase : 'https://brcommunity.xyz/community/api');
export const SITE_ORIGIN =
  process.env.EXPO_PUBLIC_BR_SITE_ORIGIN?.replace(/\/$/, '') ||
  'https://brcommunity.xyz';

const TOKEN_KEY = 'brExtensionToken';
const EMAIL_KEY = 'brHelperEmail';
const DEVICE_ID_KEY = 'brHelperDeviceId';
const LOCAL_KEYS = new Set([TOKEN_KEY, EMAIL_KEY, DEVICE_ID_KEY]);

export type ContentType = 'reel' | 'shorts' | 'video' | 'channel';
export type Scope = 'community' | 'own';
export type Layout = 'grid' | 'stack';
export type OpenMode = 'normal' | 'incognito';

export type RemoteConfig = {
  layout: Layout;
  open_interval: number;
  auto_close_min: number;
  auto_close_max: number;
  cycle_focus_enabled: boolean;
  cycle_focus_seconds: number;
  open_mode?: OpenMode;
  auto_open?: boolean;
};

export type LinkItem = {
  id: string | number;
  url: string;
  title?: string;
  thumbnail?: string;
  channel_title?: string;
  creator?: string;
};

export type User = { email?: string; name?: string };

const DEFAULTS: Record<ContentType, RemoteConfig> = {
  channel: { layout: 'grid', open_interval: 10, auto_close_min: 37, auto_close_max: 70, cycle_focus_enabled: true, cycle_focus_seconds: 8, auto_open: true },
  video: { layout: 'grid', open_interval: 10, auto_close_min: 37, auto_close_max: 70, cycle_focus_enabled: true, cycle_focus_seconds: 8, auto_open: true },
  reel: { layout: 'stack', open_interval: 5, auto_close_min: 5, auto_close_max: 15, cycle_focus_enabled: true, cycle_focus_seconds: 5, auto_open: true },
  shorts: { layout: 'stack', open_interval: 5, auto_close_min: 5, auto_close_max: 15, cycle_focus_enabled: true, cycle_focus_seconds: 5, auto_open: true },
};

async function readLocal(key: string): Promise<string> {
  if (Platform.OS !== 'web') {
    return (await SecureStore.getItemAsync(key)) || '';
  }
  return (await AsyncStorage.getItem(key)) || '';
}

async function writeLocal(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function deleteLocal(key: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function getStoredToken(): Promise<string> {
  return readLocal(TOKEN_KEY);
}

export async function getStoredEmail(): Promise<string> {
  return readLocal(EMAIL_KEY);
}

export async function getDeviceIdentity(): Promise<string> {
  const existing = (await readLocal(DEVICE_ID_KEY)).trim();
  if (existing) return existing;
  const generated = `android-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await writeLocal(DEVICE_ID_KEY, generated);
  return generated;
}

export async function clearCredentials(): Promise<void> {
  await Promise.all([...LOCAL_KEYS].map(deleteLocal));
}

export async function saveCredentials(email: string, token: string): Promise<void> {
  await Promise.all([writeLocal(EMAIL_KEY, email), writeLocal(TOKEN_KEY, token)]);
}

export function defaultsFor(type: ContentType): RemoteConfig {
  return { ...DEFAULTS[type] };
}

function errorForStatus(status: number, body: Record<string, unknown>): Error & { status?: number } {
  const error = new Error(
    String(body.error || body.message || (status === 401 ? 'Extension session expired. Please sign in again.' : `Request failed (${status})`)),
  ) as Error & { status?: number };
  error.status = status;
  return error;
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}`, 'X-BRCommunity-Extension-Token': token } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  let response: Response;
  const startedAt = Date.now();
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: 'no-store' });
    void trackEvent('api.request', { method: options.method || 'GET', status: response.status, duration_ms: Date.now() - startedAt });
  } catch (error) {
    void trackEvent('api.network_error', { method: options.method || 'GET', duration_ms: Date.now() - startedAt }, 'error');
    captureException(error, { operation: 'api.request', method: options.method || 'GET' });
    throw new Error(`Unable to connect to BRCommunity at ${API_BASE}. Check your connection.`);
  }
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(response.ok ? 'Invalid server response.' : `Server error (${response.status}).`);
  }
  if (!response.ok) {
    const error = errorForStatus(response.status, body);
    void trackEvent('api.http_error', { method: options.method || 'GET', status: response.status }, response.status >= 500 ? 'error' : 'warning');
    if (response.status >= 500) captureException(error, { operation: 'api.http_error', status: response.status });
    throw error;
  }
  return body as T;
}

export async function signIn(email: string, password: string): Promise<User> {
  const deviceId = await getDeviceIdentity();
  const data = await apiJson<{ extension_token?: string; user?: User; email?: string }>('/auth/extension-login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      device_id: deviceId,
      device_label: Platform.OS === 'web' ? 'Web Preview Helper' : 'Android Helper',
    }),
  });
  if (!data.extension_token) throw new Error('The server did not return an extension token.');
  await saveCredentials(email, data.extension_token);
  return data.user || { email: data.email || email };
}

export async function checkSession(): Promise<User | null> {
  const token = await getStoredToken();
  if (!token) return null;
  try {
    const data = await apiJson<{ user?: User; email?: string }>('/auth/extension-me');
    return data.user || { email: data.email || (await getStoredEmail()) };
  } catch (error) {
    if ((error as { status?: number }).status === 401) {
      await clearCredentials();
      return null;
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    if (await getStoredToken()) await apiJson('/auth/extension-logout', { method: 'POST' });
  } finally {
    await clearCredentials();
  }
}

export function normalizeConfig(raw: Partial<RemoteConfig> | undefined, type: ContentType): RemoteConfig {
  const base = defaultsFor(type);
  const clampSeconds = (value: unknown, fallback: number, min: number, max: number) => {
    const numeric = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(numeric) ? Math.round(numeric) : fallback));
  };
  const min = clampSeconds(raw?.auto_close_min, base.auto_close_min, 1, 24 * 60 * 60);
  return {
    layout: raw?.layout === 'stack' || raw?.layout === 'grid' ? raw.layout : base.layout,
    open_interval: clampSeconds(raw?.open_interval, base.open_interval, 1, 24 * 60 * 60),
    auto_close_min: min,
    auto_close_max: clampSeconds(raw?.auto_close_max, base.auto_close_max, min, 24 * 60 * 60),
    cycle_focus_enabled: raw?.cycle_focus_enabled !== false,
    cycle_focus_seconds: clampSeconds(raw?.cycle_focus_seconds, base.cycle_focus_seconds, 3, 60 * 60),
    open_mode: raw?.open_mode === 'incognito' ? 'incognito' : 'normal',
    auto_open: raw?.auto_open !== false,
  };
}

export function resolveOpenMode(
  config: RemoteConfig,
  openModes: { type?: string; community?: string; own?: string } | undefined,
  scope: Scope,
): OpenMode {
  const scopedMode = scope === 'own' ? openModes?.own : openModes?.community;
  if (scopedMode === 'incognito' || scopedMode === 'normal') return scopedMode;
  return config.open_mode === 'incognito' ? 'incognito' : 'normal';
}

export function randomCloseSeconds(config: RemoteConfig): number {
  const min = Math.max(1, config.auto_close_min);
  const max = Math.max(min, config.auto_close_max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TRUSTED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtu.be',
]);

const TRUSTED_INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
]);

export type ManagedPlatform = 'youtube' | 'instagram';

function parseTrustedUrl(value: string): { url: URL; platform: ManagedPlatform } | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== '443') return null;
    if (url.hostname.includes('\u0000')) return null;
    if (TRUSTED_YOUTUBE_HOSTS.has(host)) return { url, platform: 'youtube' };
    if (TRUSTED_INSTAGRAM_HOSTS.has(host)) return { url, platform: 'instagram' };
  } catch {
    // Invalid or non-standard URLs are rejected.
  }
  return null;
}

/** Returns a canonical HTTPS URL only for explicitly trusted content hosts. */
export function normalizeManagedUrl(value: string): string | null {
  const parsed = parseTrustedUrl(value);
  if (!parsed) return null;
  const { url } = parsed;
  url.hash = '';
  return url.toString();
}

export function platformForUrl(url: string): 'youtube' | 'instagram' | 'other' {
  return parseTrustedUrl(url)?.platform || 'other';
}

/**
 * WebView navigation policy. The initial managed platform may redirect between
 * trusted first-party hosts (for example youtu.be -> www.youtube.com), but it may
 * never leave HTTPS or the platform allowlist.
 */
export function isAllowedManagedNavigation(url: string, initialUrl: string): boolean {
  const candidate = parseTrustedUrl(url);
  const initial = parseTrustedUrl(initialUrl);
  if (!candidate || !initial) return false;
  return candidate.platform === initial.platform;
}

export function isAllowedManagedUrl(url: string): boolean {
  return parseTrustedUrl(url) !== null;
}

export const WEBVIEW_BOOTSTRAP = `
(function() {
  const text = (el) => ((el && (el.getAttribute('aria-label') || el.textContent || '')) + '').trim().toLowerCase();
  const click = (el) => { try { (el.closest('button, [role="button"], a') || el).click(); return true; } catch (_) { return false; } };
  const pressed = (el) => ['true', '1'].includes((el?.getAttribute('aria-pressed') || '').toLowerCase());
  window.__BR_ENGAGE__ = function() {
    const host = location.hostname.toLowerCase();
    const clicked = [];
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'gaming.youtube.com'].includes(host) || host === 'youtu.be') {
      const like = Array.from(document.querySelectorAll('button, [role="button"]')).find((el) => {
        const label = text(el);
        return label.includes('like') && !label.includes('dislike') && !label.includes('unlike') && !pressed(el);
      });
      if (like && click(like)) clicked.push('like');
      const subscribe = Array.from(document.querySelectorAll('button, [role="button"], tp-yt-paper-button')).find((el) => {
        const label = text(el);
        return label.includes('subscribe') && !label.includes('subscribed') && !label.includes('unsubscribe');
      });
      if (subscribe && click(subscribe)) clicked.push('subscribe');
    } else if (host === 'instagram.com' || host === 'www.instagram.com') {
      const like = Array.from(document.querySelectorAll('svg[aria-label*="like" i], button, [role="button"]')).find((el) => {
        const label = text(el);
        return (label === 'like' || label.includes('like')) && !label.includes('unlike') && !pressed(el);
      });
      if (like && click(like)) clicked.push('like');
      const follow = Array.from(document.querySelectorAll('button, [role="button"], a[role="button"]')).find((el) => {
        const label = text(el);
        return (label === 'follow' || label === 'follow this account');
      });
      if (follow && click(follow)) clicked.push('follow');
    }
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'engagement', clicked }));
    return clicked;
  };
  const play = () => {
    const videos = Array.from(document.querySelectorAll('video'));
    const video = videos.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0];
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    const promise = video.play();
    promise?.catch?.(() => { video.muted = true; video.play().catch(() => {}); });
  };
  let tries = 0;
  const timer = setInterval(() => { play(); if (++tries > 30) clearInterval(timer); }, 700);
  new MutationObserver(play).observe(document.documentElement, { childList: true, subtree: true });
  true;
})();
`;

export const WEBVIEW_ENABLE_AUDIO = `
(function() {
  const activate = () => {
    const videos = Array.from(document.querySelectorAll('video'));
    const video = videos.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0];
    if (video) {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
      video.play().catch(() => {});
    }
    const audioButton = Array.from(document.querySelectorAll('button, [role="button"]')).find((el) => {
      const label = ((el.getAttribute('aria-label') || el.textContent || '') + '').toLowerCase();
      return label.includes('unmute') || label.includes('audio is muted') || label === 'play sound';
    });
    if (audioButton) {
      try { audioButton.click(); } catch (_) {}
    }
  };
  activate();
  let tries = 0;
  const timer = setInterval(() => {
    activate();
    if (++tries >= 20) clearInterval(timer);
  }, 250);
  true;
})();
`;