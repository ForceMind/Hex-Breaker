import Phaser from 'phaser';
import { themeColors } from '../config/themes';
import { services } from '../services';
import { Button } from './Button';
import { Modal } from './Modal';
import { showToast } from './Toast';
import type { BaseScene } from '../scenes/BaseScene';

export interface RechargePack {
  coins: number;
  /** Simulated CNY price shown on the button. */
  price: number;
  /** Bonus flag shown on the card (e.g. 性价比). */
  tag?: string;
}

export const RECHARGE_PACKS: readonly RechargePack[] = [
  { coins: 60, price: 6 },
  { coins: 300, price: 30 },
  { coins: 680, price: 68, tag: '划算' },
  { coins: 1280, price: 128, tag: '超值' },
] as const;

/**
 * Simulated in-app purchase sheet (no real payment): 2x2 pack grid; tapping
 * a pack opens a fake payment confirmation with a spinner, then coins are
 * granted. Follows the active theme palette (no dedicated artwork).
 */
export function openRechargeModal(scene: BaseScene, designW: number, designH: number, onPurchased?: () => void): void {
  const COLORS = themeColors();
  const modal = new Modal(scene, designW, designH, { width: 420, height: 480, title: '金币充值' });
  const panel = modal.panel;

  panel.add(scene.text(0, -160, '模拟充值 · 不会产生真实扣费', { size: 13, color: COLORS.textSecondary }));

  RECHARGE_PACKS.forEach((pack, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cardW = 176;
    const cardH = 108;
    const x = (col === 0 ? -1 : 1) * (cardW / 2 + 8);
    const y = -86 + row * (cardH + 14) + cardH / 2;

    const card = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(-cardW / 2, -cardH / 2 + 3, cardW, cardH, 14);
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
    g.lineStyle(1.5, COLORS.accent, 0.45);
    g.strokeRoundedRect(-cardW / 2 + 0.75, -cardH / 2 + 0.75, cardW - 1.5, cardH - 1.5, 13);
    card.add(g);

    // gold coin icon
    g.fillStyle(0xffb703, 1);
    g.fillCircle(0, -26, 16);
    g.fillStyle(0xcc8800, 1);
    g.fillCircle(0, -26, 8);

    card.add(scene.text(0, 6, `${pack.coins} 金币`, { size: 18, bold: true, color: themeColors().panelText }));
    if (pack.tag) {
      const tagG = scene.add.graphics();
      tagG.fillStyle(COLORS.danger, 1);
      tagG.fillRoundedRect(cardW / 2 - 46, -cardH / 2 + 6, 40, 18, 9);
      card.add(tagG);
      card.add(scene.text(cardW / 2 - 26, -cardH / 2 + 15, pack.tag, { size: 11, bold: true, color: 0xffffff }));
    }
    const buy = new Button(scene, 0, 34, {
      label: `¥${pack.price}`,
      width: 120,
      height: 34,
      fontSize: 15,
      radius: 17,
      onClick: () => startFakePayment(pack),
    });
    card.add(buy);
    panel.add(card);
  });

  const close = new Button(scene, 0, 178, { label: '关闭', variant: 'secondary', width: 200, height: 48, onClick: () => modal.close() });
  panel.add(close);

  function startFakePayment(pack: RechargePack): void {
    modal.close();
    const pay = new Modal(scene, designW, designH, { width: 360, height: 300, title: '模拟支付' });
    pay.panel.add(scene.text(0, -66, `${pack.coins} 金币`, { size: 24, bold: true, color: themeColors().panelText }));
    pay.panel.add(scene.text(0, -30, `应付 ¥${pack.price}（模拟）`, { size: 15, color: COLORS.textSecondary }));
    const spinner = scene.text(0, 22, '支付中…', { size: 16, bold: true, color: COLORS.accent });
    pay.panel.add(spinner);
    scene.tweens.add({ targets: spinner, alpha: 0.3, duration: 320, yoyo: true, repeat: -1 });
    scene.time.delayedCall(900, () => {
      services().save.addCoins(pack.coins);
      pay.close();
      showToast(scene, designW / 2, designH * 0.4, `充值成功 +${pack.coins} 金币`);
      services().audio.pickup();
      onPurchased?.();
    });
  }
}
