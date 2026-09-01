export type ChromeControlStatus = {
  supported: boolean;
  enabled: boolean;
  chromeInstalled: boolean;
};

export async function getChromeControlStatus(): Promise<ChromeControlStatus> {
  return { supported: false, enabled: false, chromeInstalled: false };
}

export async function openChromeAccessibilitySettings(): Promise<void> {
  throw new Error('Chrome control is available only in the native Android build.');
}

export async function openChromeUrl(_url: string, _tabId: string, _incognito?: boolean): Promise<void> {
  throw new Error('Chrome control is available only in the native Android build.');
}

export async function closeChromeTab(_tabId: string, _expectedUrl?: string): Promise<boolean> {
  throw new Error('Chrome control is available only in the native Android build.');
}

export async function engageChromeTab(_tabId: string, _expectedUrl?: string): Promise<boolean> {
  throw new Error('Chrome control is available only in the native Android build.');
}

export async function scheduleChromeTabLifecycle(
  _tabId: string,
  _expectedUrl: string,
  _closeAt: number,
  _engageAt: number,
): Promise<void> {
  throw new Error('Chrome control is available only in the native Android build.');
}

export async function cancelChromeTabLifecycle(_tabId: string): Promise<void> {
  throw new Error('Chrome control is available only in the native Android build.');
}

export async function clearChromeTabLifecycles(): Promise<void> {
  throw new Error('Chrome control is available only in the native Android build.');
}