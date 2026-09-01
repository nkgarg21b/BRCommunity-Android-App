import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

const TELEMETRY_KEY = 'brTelemetryBuffer';
const MAX_BUFFER = 200;
const APP_VERSION = Constants.expoConfig?.version || 'unknown';
const ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production');
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '';

export type TelemetryLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';
export type TelemetryFields = Record<string, string | number | boolean | null | undefined>;

let initialized = false;
let bufferWrite: Promise<void> = Promise.resolve();

function sanitizeFields(fields: TelemetryFields | undefined): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (value === undefined) continue;
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes('token') ||
      normalizedKey.includes('password') ||
      normalizedKey.includes('authorization') ||
      normalizedKey.includes('cookie') ||
      normalizedKey.includes('email') ||
      normalizedKey.includes('url')
    ) {
      continue;
    }
    result[key] = typeof value === 'string' && value.length > 256 ? value.slice(0, 256) : value;
  }
  return result;
}

export function initTelemetry(): void {
  if (initialized) return;
  initialized = true;

  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: `brcommunity-android-helper@${APP_VERSION}`,
    enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEV === 'true',
    tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.05),
    sendDefaultPii: false,
    enableLogs: false,
    maxBreadcrumbs: 100,
    beforeSend(event) {
      // Never ship credentials, raw API payloads, or managed URLs to crash reporting.
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.url) event.request.url = '[redacted]';
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }
      return event;
    },
  });

  Sentry.setTag('platform', Platform.OS);
  Sentry.setTag('app_version', APP_VERSION);
  Sentry.setTag('environment', ENVIRONMENT);
}

export async function trackEvent(
  name: string,
  fields: TelemetryFields = {},
  level: TelemetryLevel = 'info',
): Promise<void> {
  const safeFields = sanitizeFields(fields);
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.slice(0, 100),
    level,
    at: Date.now(),
    fields: safeFields,
  };

  bufferWrite = bufferWrite.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(TELEMETRY_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const buffer = Array.isArray(existing) ? existing.slice(0, MAX_BUFFER - 1) : [];
      await AsyncStorage.setItem(TELEMETRY_KEY, JSON.stringify([event, ...buffer]));
    } catch {
      // Telemetry must never affect application behavior.
    }
  });
  await bufferWrite;

  if (!DSN) return;
  Sentry.addBreadcrumb({
    category: 'brcommunity',
    message: name.slice(0, 100),
    level: level === 'fatal' ? 'fatal' : level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
    data: safeFields,
  });
}

export function captureException(error: unknown, context: TelemetryFields = {}): void {
  if (!DSN) return;
  const normalized = error instanceof Error ? error : new Error(String(error));
  Sentry.withScope((scope) => {
    const safeFields = sanitizeFields(context);
    for (const [key, value] of Object.entries(safeFields)) scope.setTag(`ctx_${key}`, String(value));
    Sentry.captureException(normalized);
  });
}

export function setTelemetryContext(context: TelemetryFields): void {
  if (!DSN) return;
  const safeFields = sanitizeFields(context);
  Sentry.withScope((scope) => {
    scope.setContext('runtime', safeFields);
  });
  for (const [key, value] of Object.entries(safeFields)) Sentry.setTag(key, String(value));
}

export async function getTelemetryBuffer(): Promise<unknown[]> {
  try {
    const raw = await AsyncStorage.getItem(TELEMETRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
