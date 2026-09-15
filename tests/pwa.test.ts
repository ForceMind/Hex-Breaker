import { describe, expect, it } from 'vitest';
import { isAndroidInstallBrowser, isInAppBrowser, isIosSafari, resolveInstallPlatform } from '../src/services/pwa';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const WECHAT_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40';
const WECHAT_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.40';
const UC_ANDROID = 'Mozilla/5.0 (Linux; U; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 UCBrowser/16.0 Mobile Safari/537.36';
const DESKTOP_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('UA sniffers', () => {
  it('isIosSafari: only genuine iOS Safari, not CriOS or WeChat', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(WECHAT_IOS)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
    expect(isIosSafari(DESKTOP_CHROME)).toBe(false);
    // iPadOS desktop-mode UA: MacIntel + touch points
    expect(isIosSafari(DESKTOP_CHROME, 'MacIntel', 5)).toBe(true);
  });

  it('isInAppBrowser: WeChat / QQ / UC / webview', () => {
    expect(isInAppBrowser(WECHAT_IOS)).toBe(true);
    expect(isInAppBrowser(WECHAT_ANDROID)).toBe(true);
    expect(isInAppBrowser(UC_ANDROID)).toBe(true);
    expect(isInAppBrowser(`${ANDROID_CHROME} wv)`)).toBe(true);
    expect(isInAppBrowser(ANDROID_CHROME)).toBe(false);
  });

  it('isAndroidInstallBrowser: Chrome on Android, excluding in-app', () => {
    expect(isAndroidInstallBrowser(ANDROID_CHROME)).toBe(true);
    expect(isAndroidInstallBrowser(WECHAT_ANDROID)).toBe(false);
    expect(isAndroidInstallBrowser(UC_ANDROID)).toBe(false);
    expect(isAndroidInstallBrowser(IPHONE_SAFARI)).toBe(false);
  });
});

describe('resolveInstallPlatform', () => {
  it('ios / android / none', () => {
    expect(resolveInstallPlatform({ userAgent: IPHONE_SAFARI })).toBe('ios');
    expect(resolveInstallPlatform({ userAgent: ANDROID_CHROME })).toBe('android');
    expect(resolveInstallPlatform({ userAgent: DESKTOP_CHROME })).toBe('none');
  });

  it('in-app browsers and standalone mode never offer a flow', () => {
    expect(resolveInstallPlatform({ userAgent: WECHAT_ANDROID })).toBe('none');
    expect(resolveInstallPlatform({ userAgent: IPHONE_SAFARI, standalone: true })).toBe('none');
    expect(resolveInstallPlatform({ userAgent: ANDROID_CHROME, standalone: true })).toBe('none');
  });
});
