import { NativeModules, Platform } from 'react-native';
import { captureException, trackEvent } from '@/lib/telemetry';

export type ChromeControlStatus = {
  supported: boolean;
  enabled: boolean;
  chromeInstalled: boolean;
};

type ChromeControlNativeModule = {
  getStatus: () => Promise<ChromeControlStatus>;
  openAccessibilitySettings: () => Promise<void>;
  openChromeUrl: (url: string, tabId: string, incognito: boolean) => Promise<void>;
  closeTab: (tabId: string, expectedUrl: string) => Promise<boolean>;
  engageTab: (tabId: string, expectedUrl: string) => Promise<boolean>;
  scheduleTabLifecycle: (tabId: string, expectedUrl: string, closeAt: number, engageAt: number) => Promise<void>;
  cancelTabLifecycle: (tabId: string) => Promise<void>;
  clearTabLifecycles: () => Promise<void>;
};

const nativeModule = NativeModules.ChromeControl as ChromeControlNativeModule | undefined;

function unavailable(): never {
  throw new Error(
    Platform.OS === 'android'
      ? 'Chrome control is not linked. Install the custom Android build and enable its native module.'
      : 'Chrome control is available only on Android.',
  );
}

export async function getChromeControlStatus(): Promise<ChromeControlStatus> {
  if (!nativeModule) return { supported: false, enabled: false, chromeInstalled: false };
  return nativeModule.getStatus();
}

export async function openChromeAccessibilitySettings(): Promise<void> {
  if (!nativeModule) unavailable();
  await nativeModule.openAccessibilitySettings();
}

export async function openChromeUrl(url: string, tabId: string, incognito = false): Promise<void> {
  if (!nativeModule) unavailable();
  try {
    await nativeModule.openChromeUrl(url, tabId, incognito);
    void trackEvent('chrome.open', { incognito });
  } catch (error) {
    void trackEvent('chrome.open_failed', { incognito }, 'error');
    captureException(error, { operation: 'chrome.open' });
    throw error;
  }
}

export async function closeChromeTab(tabId: string, expectedUrl = ''): Promise<boolean> {
  if (!nativeModule) unavailable();
  try {
    const result = Boolean(await nativeModule.closeTab(tabId, expectedUrl));
    void trackEvent('chrome.close', { success: result });
    return result;
  } catch (error) {
    void trackEvent('chrome.close_failed', {}, 'error');
    captureException(error, { operation: 'chrome.close' });
    throw error;
  }
}

export async function engageChromeTab(tabId: string, expectedUrl = ''): Promise<boolean> {
  if (!nativeModule) unavailable();
  try {
    const result = Boolean(await nativeModule.engageTab(tabId, expectedUrl));
    void trackEvent('chrome.engage', { success: result });
    return result;
  } catch (error) {
    void trackEvent('chrome.engage_failed', {}, 'error');
    captureException(error, { operation: 'chrome.engage' });
    throw error;
  }
}

export async function scheduleChromeTabLifecycle(tabId: string, expectedUrl: string, closeAt: number, engageAt: number): Promise<void> {
  if (!nativeModule) unavailable();
  await nativeModule.scheduleTabLifecycle(tabId, expectedUrl, closeAt, engageAt);
}

export async function cancelChromeTabLifecycle(tabId: string): Promise<void> {
  if (!nativeModule) unavailable();
  await nativeModule.cancelTabLifecycle(tabId);
}

export async function clearChromeTabLifecycles(): Promise<void> {
  if (!nativeModule) unavailable();
  await nativeModule.clearTabLifecycles();
}