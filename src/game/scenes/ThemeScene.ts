import Phaser from 'phaser';
import { themeColors, setActiveTheme, THEMES, THEME_IDS, type ThemeDef } from '../config/themes';
import { tileTexture } from '../rendering/textures';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { showToast } from '../ui/Toast';
import { BaseScene } from './BaseScene';

const CARD_W = 220;
const CARD_H = 190;
const GAP = 20;

/**
 * Theme shop: 2x2 cards with a two-band gradient preview and a mini tile.
 * States: in use (accent frame) / owned / priced (greys out when broke).
 * Tapping a locked card opens a purchase-confirm modal.
 */
export class ThemeScene extends BaseScene {
  constructor() {
    super('ThemeScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();
    const COLORS = themeColors();

    const cx = this.W / 2;
    this.text(cx, 62, '主题皮肤', { size: 34, bold: true });

    const save = this.svc.save.get();
    // Coin balance capsule under the title.
    const coinText = this.text(cx + 14, 106, String(save.economy.coins), { size: 17, bold: true });
    const cg = this.add.graphics();
    cg.fillStyle(0x000000, 0.12);
    cg.fillRoundedRect(cx - 58, 91 + 3, 116, 32, 16);
    cg.fillStyle(0xffffff, 0.88);
    cg.fillRoundedRect(cx - 58, 91, 116, 32, 16);
    cg.fillStyle(0xffb703, 1);
    cg.fillCircle(cx - 40, 107, 10);
    cg.fillStyle(0xcc8800, 1);
    cg.fillCircle(cx - 40, 107, 5);

    const top = 200;
    THEME_IDS.forEach((id, i) => {
      const theme = THEMES[id];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardX = cx + (col === 0 ? -(CARD_W / 2 + GAP / 2) : CARD_W / 2 + GAP / 2);
      const cardY = top + row * (CARD_H + GAP) + CARD_H / 2;
      this.buildCard(cardX, cardY, theme, save.selectedTheme === id, save.unlockedThemes.includes(id), save.economy.coins);
    });

    new Button(this, cx, this.H - 56, { label: '返回主页', variant: 'secondary', width: 320, height: 60, onClick: () => this.go('HomeScene') });
    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }

  private buildCard(x: number, y: number, theme: ThemeDef, inUse: boolean, owned: boolean, coins: number): void {
    const card = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 4, CARD_W, CARD_H, 18);
    // two-band preview: bgTop over bgBottom
    g.fillStyle(theme.colors.bgTop, 1);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    g.fillStyle(theme.colors.bgBottom, 1);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 96, CARD_W, CARD_H - 96, { tl: 0, tr: 0, bl: 18, br: 18 });
    // straight seam line between the two bands
    g.fillRect(-CARD_W / 2 + 2, -CARD_H / 2 + 94, CARD_W - 4, 4);
    if (inUse) {
      g.lineStyle(3, themeColors().accent, 1);
      g.strokeRoundedRect(-CARD_W / 2 + 1.5, -CARD_H / 2 + 1.5, CARD_W - 3, CARD_H - 3, 17);
    }
    card.add(g);

    // mini tile sample on the preview
    const mini = this.add.image(0, -38, tileTexture(4)).setTint(theme.colors.tile).setDisplaySize(64, 64);
    card.add(mini);

    // theme name sits on the lower preview band; each palette's own
    // textPrimary stays readable on its bgBottom (neon: light on dark).
    card.add(this.text(0, 28, theme.name, { size: 20, bold: true, color: theme.colors.textPrimary }));

    if (inUse) {
      card.add(this.text(0, 62, '使用中', { size: 14, bold: true, color: themeColors().accent }));
    } else if (owned) {
      card.add(this.text(0, 62, '可使用', { size: 14, color: themeColors().textSecondary }));
    } else {
      const affordable = coins >= theme.price;
      const row = this.add.container(0, 62);
      const pg = this.add.graphics();
      pg.fillStyle(0xffb703, affordable ? 1 : 0.4);
      pg.fillCircle(-24, 0, 8);
      pg.fillStyle(0xcc8800, affordable ? 1 : 0.4);
      pg.fillCircle(-24, 0, 4);
      row.add([pg, this.text(-10, 0, String(theme.price), { size: 15, bold: true, align: 'left', color: affordable ? 0xcc8800 : 0x9aa5b5 })]);
      card.add(row);
      if (!affordable) card.setAlpha(0.65);
    }

    card.setSize(CARD_W, CARD_H);
    card.setInteractive(new Phaser.Geom.Rectangle(0, 0, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    card.on('pointerdown', () => {
      this.tweens.killTweensOf(card);
      this.tweens.add({ targets: card, scaleX: 0.95, scaleY: 0.95, duration: 70, ease: 'Quad.easeOut' });
    });
    const release = (): void => {
      this.tweens.killTweensOf(card);
      this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
    };
    card.on('pointerup', (p: Phaser.Input.Pointer) => {
      release();
      if (p.getDistance() > 14) return;
      this.svc.audio.button();
      this.svc.vibration.tap();
      this.onCardTap(theme, owned);
    });
    card.on('pointerout', release);
    card.on('pointerupoutside', release);
  }

  private onCardTap(theme: ThemeDef, owned: boolean): void {
    if (owned) {
      this.svc.save.selectTheme(theme.id);
      setActiveTheme(theme.id);
      showToast(this, this.W / 2, this.H * 0.5, `已切换到「${theme.name}」`);
      this.time.delayedCall(450, () => this.refresh());
      return;
    }
    // purchase confirm
    const coins = this.svc.save.get().economy.coins;
    const modal = new Modal(this, this.W, this.H, { width: 400, height: 330, title: `解锁「${theme.name}」` });
    modal.panel.add(this.text(0, -60, `需要 ${theme.price} 金币（当前 ${coins}）`, { size: 18, bold: true }));
    modal.panel.add(this.text(0, -26, coins >= theme.price ? '解锁后立即应用该主题。' : '金币不足，去闯关或每日挑战赚取吧！', { size: 14, color: themeColors().textSecondary }));
    const buy = new Button(this, 0, 44, {
      label: `支付 ${theme.price} 金币`,
      width: 280,
      height: 58,
      enabled: coins >= theme.price,
      onClick: () => {
        if (!this.svc.save.spendCoins(theme.price)) return;
        this.svc.save.unlockTheme(theme.id);
        this.svc.save.selectTheme(theme.id);
        setActiveTheme(theme.id);
        modal.close();
        showToast(this, this.W / 2, this.H * 0.5, `已解锁「${theme.name}」！`);
        this.time.delayedCall(450, () => this.refresh());
      },
    });
    const cancel = new Button(this, 0, 118, { label: '取消', variant: 'secondary', width: 280, height: 52, onClick: () => modal.close() });
    modal.panel.add([buy, cancel]);
  }
}
