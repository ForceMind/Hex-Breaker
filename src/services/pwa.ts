/**
 * PWA wiring: service-worker registration plus install-prompt gating.
 *
 * The UA/display-mode sniffers are pure functions (unit-tested); the browser
 * side only captures `beforeinstallprompt` and tells scenes whether an
 * install entry is meaningful. The actual guide/invite UI is a Phaser Modal
 * owned by the scenes.
 */

export interface InstallEnv {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  /** display-mode: standalone or the iOS navigator.standalone flag. */
  standalone?: boolean;
}

export type InstallPlatform = 'ios' | 'android' | 'none';

/** WeChat/QQ/UC and other in-app or non-standard browsers: no reliable flow. */
export function isInAppBrowser(userAgent: string): boolean {
  return /MicroMessenger|QQBrowser|MQQBrowser|Quark|UCBrowser|Baidu|HeyTapBrowser|HuaweiBrowser|MiuiBrowser|wv\)/i.test(userAgent);
}

export function isIosSafari(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  return ios && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA/i.test(userAgent) && !isInAppBrowser(userAgent);
}

export function isAndroidInstallBrowser(userAgent: string): boolean {
  return /Android/i.test(userAgent) && /Chrome|EdgA|SamsungBrowser/i.test(userAgent) && !isInAppBrowser(userAgent);
}

/** Which install flow this environment supports (none inside in-app/standalone). */
export function resolveInstallPlatform(env: InstallEnv): InstallPlatform {
  if (env.standalone) return 'none';
  if (isIosSafari(env.userAgent, env.platform ?? '', env.maxTouchPoints ?? 0)) return 'ios';
  if (isAndroidInstallBrowser(env.userAgent)) return 'android';
  return 'none';
}

// --- browser side ------------------------------------------------------------

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: InstallPromptEvent | null = null;

function currentEnv(): InstallEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
  };
}

export function installPlatform(): InstallPlatform {
  return resolveInstallPlatform(currentEnv());
}

/** Whether scenes should show an 「安装到主屏」 entry right now. */
export function canShowInstallEntry(): boolean {
  const platform = installPlatform();
  if (platform === 'ios') return true;
  return platform === 'android' && deferredPrompt !== null;
}

/**
 * Run the platform install flow. iOS has no programmatic prompt: the scene
 * shows the guide Modal itself, so this reports back what to do.
 */
export async function triggerInstall(): Promise<'ios-guide' | 'prompted' | 'accepted' | 'dismissed' | 'unavailable'> {
  const platform = installPlatform();
  if (platform === 'ios') return 'ios-guide';
  if (platform !== 'android' || !deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  deferredPrompt = null;
  const result = await prompt.prompt();
  return result.outcome === 'accepted' ? 'accepted' : 'dismissed';
}

/** Register the offline service worker (production only). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch((error: unknown) => {
    console.warn('[hex-breaker] service worker registration failed', error);
  });
}

/** Wire up PWA at boot: sw registration + deferred Android prompt capture. */
export function initialisePwa(): void {
  registerServiceWorker();
  if (installPlatform() !== 'android') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
}
