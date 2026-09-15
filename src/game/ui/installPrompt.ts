/**
 * 「安装到主屏」flow as Phaser UI (the pwa.ts service only knows UA gating).
 * iOS gets the Apple-required manual guide; Android triggers the captured
 * beforeinstallprompt. The automatic invite appears once ever, on the
 * player's second visit to the home screen.
 */
import { canShowInstallEntry, installPlatform, triggerInstall } from '../../services/pwa';
import { DESIGN_WIDTH, MIN_DESIGN_HEIGHT } from '../config/layout';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { showToast } from '../ui/Toast';
import type { BaseScene } from '../scenes/BaseScene';

const HOME_VISITS_KEY = 'hex-breaker:home-visits';
const AUTO_SHOWN_KEY = 'hex-breaker:install-auto-shown';

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage restrictions must not break gameplay
  }
}

/** Open the platform-appropriate install UI from a button tap. */
export function openInstallFlow(scene: BaseScene): void {
  if (installPlatform() === 'ios') {
    showIosGuideModal(scene);
    return;
  }
  void triggerInstall().then((outcome) => {
    if (outcome === 'accepted') showToast(scene, designW(scene) / 2, designH(scene) / 2, '已添加到主屏幕！');
    else if (outcome === 'unavailable') showIosGuideModal(scene); // prompt not captured yet: fall back to guidance
  });
}

/** Scenes live in design units, not device pixels (camera zoom = dpr). */
function designW(_scene: BaseScene): number {
  return DESIGN_WIDTH;
}

function designH(scene: BaseScene): number {
  return (scene.registry.get('designHeight') as number | undefined) ?? MIN_DESIGN_HEIGHT;
}

function showIosGuideModal(scene: BaseScene): void {
  const modal = new Modal(scene, designW(scene), designH(scene), { width: 420, height: 340, title: '安装到主屏幕' });
  const body = scene.text(0, -40, 'iOS 请手动添加：\n\n1. 点击 Safari 底栏的「分享」按钮\n2. 下滑选择「添加到主屏幕」\n3. 点击右上角「添加」', {
    size: 16,
    lineSpacing: 8,
    wrap: 340,
  });
  modal.panel.add(body);
  modal.panel.add(new Button(scene, 0, 100, { label: '知道了', width: 240, height: 56, onClick: () => modal.close() }));
}

function showInviteModal(scene: BaseScene): void {
  const modal = new Modal(scene, designW(scene), designH(scene), { width: 420, height: 330, title: '安装到主屏幕' });
  modal.panel.add(scene.text(0, -46, '把瓦片破坏者装到主屏，\n随时点开就玩，还能离线对战。', { size: 17, lineSpacing: 8 }));
  modal.panel.add([
    new Button(scene, 0, 36, {
      label: '立即安装',
      width: 280,
      height: 58,
      onClick: () => {
        modal.close();
        openInstallFlow(scene);
      },
    }),
    new Button(scene, 0, 108, { label: '以后再说', variant: 'secondary', width: 280, height: 52, onClick: () => modal.close() }),
  ]);
}

/**
 * Called from HomeScene.create: on the SECOND home visit (and only once per
 * origin) pop the install invite when an install flow exists.
 */
export function autoPromptInstallIfDue(scene: BaseScene): void {
  const visits = Number(storageGet(HOME_VISITS_KEY) ?? '0') + 1;
  storageSet(HOME_VISITS_KEY, String(visits));
  if (visits !== 2 || storageGet(AUTO_SHOWN_KEY) === '1') return;
  if (!canShowInstallEntry()) return;
  storageSet(AUTO_SHOWN_KEY, '1');
  scene.time.delayedCall(900, () => {
    if (installPlatform() === 'ios') showIosGuideModal(scene);
    else showInviteModal(scene);
  });
}
