import { NativeModules, Platform } from 'react-native';

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
  beginChromeRuntimeSession: (runtimeId: string) => Promise<void>;
  touchChromeRuntimeSession: (runtimeId: string) => Promise<void>;
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
  await nativeModule.openChromeUrl(url, tabId, incognito);
}

export async function closeChromeTab(tabId: string, expectedUrl = ''): Promise<boolean> {
  if (!nativeModule) unavailable();
  return nativeModule.closeTab(tabId, expectedUrl);
}

export async function engageChromeTab(tabId: string, expectedUrl = ''): Promise<boolean> {
  if (!nativeModule) unavailable();
  return nativeModule.engageTab(tabId, expectedUrl);
}

export async function beginChromeRuntimeSession(runtimeId: string): Promise<void> {
  if (!nativeModule) unavailable();
  await nativeModule.beginChromeRuntimeSession(runtimeId);
}

export async function touchChromeRuntimeSession(runtimeId: string): Promise<void> {
  if (!nativeModule) unavailable();
  await nativeModule.touchChromeRuntimeSession(runtimeId);
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