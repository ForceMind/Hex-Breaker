import Phaser from 'phaser';
import { runAchievementsCheck } from '../achievements';
import { ASSET_TEX_FAILED_KEY } from '../config/assets';
import { resolveThemeBg, themeColors, setActiveTheme, THEMES, THEME_IDS, type ThemeDef } from '../config/themes';
import { TEX, tileTexture } from '../rendering/textures';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { showToast } from '../ui/Toast';
import { BaseScene } from './BaseScene';

const CARD_W = 210;
const CARD_H = 170;
const GAP = 16;
/** Height of the upper (bgTop) preview band; the lower band carries name/status. */
const PREVIEW_H = 104;

/**
 * Skin shop: 2 x 4 cards, each with a two-band gradient preview showing the
 * character sprite (or a tile-coloured octagon placeholder while its art is
 * missing) plus name/status below. States: in use (accent frame) / owned /
 * priced (greys out when broke). Tapping a locked card opens a purchase modal.
 */
export class ThemeScene extends BaseScene {
  private failedSprites = new Set<string>();

  constructor() {
    super('ThemeScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();
    const COLORS = themeColors();
    this.failedSprites = new Set((this.registry.get(ASSET_TEX_FAILED_KEY) as string[] | undefined) ?? []);

    const cx = this.W / 2;
    this.text(cx, 52, '主题皮肤', { size: 32, bold: true });

    const save = this.svc.save.get();
    // Coin balance capsule under the title.
    const cg = this.add.graphics();
    cg.fillStyle(0x000000, 0.12);
    cg.fillRoundedRect(cx - 58, 85 + 3, 116, 32, 16);
    cg.fillStyle(0xffffff, 0.88);
    cg.fillRoundedRect(cx - 58, 85, 116, 32, 16);
    cg.fillStyle(0xffb703, 1);
    cg.fillCircle(cx - 40, 101, 10);
    cg.fillStyle(0xcc8800, 1);
    cg.fillCircle(cx - 40, 101, 5);
    this.text(cx + 14, 101, String(save.economy.coins), { size: 17, bold: true, color: COLORS.panelText });

    const top = 134; // top edge of the grid
    THEME_IDS.forEach((id, i) => {
      const theme = THEMES[id];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardX = cx + (col === 0 ? -(CARD_W / 2 + GAP / 2) : CARD_W / 2 + GAP / 2);
      const cardY = top + row * (CARD_H + GAP) + CARD_H / 2;
      const card = this.buildCard(cardX, cardY, theme, save.selectedTheme === id, save.unlockedThemes.includes(id), save.economy.coins);
      // Entrance stagger, row by row.
      const finalY = card.y;
      card.y = finalY + 14;
      card.setAlpha(0);
      this.tweens.add({ targets: card, y: finalY, alpha: 1, duration: 260, delay: 60 + i * 45, ease: 'Quad.easeOut' });
    });

    new Button(this, cx, this.H - 50, { label: '返回主页', variant: 'secondary', width: 320, height: 56, onClick: () => this.go('HomeScene') });
    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }

  private buildCard(x: number, y: number, theme: ThemeDef, inUse: boolean, owned: boolean, coins: number): Phaser.GameObjects.Container {
    const card = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 4, CARD_W, CARD_H, 18);
    // two-band preview: bgTop over bgBottom
    g.fillStyle(theme.colors.bgTop, 1);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    g.fillStyle(theme.colors.bgBottom, 1);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + PREVIEW_H, CARD_W, CARD_H - PREVIEW_H, { tl: 0, tr: 0, bl: 18, br: 18 });
    // straight seam between the two bands
    g.fillRect(-CARD_W / 2 + 2, -CARD_H / 2 + PREVIEW_H - 2, CARD_W - 4, 4);
    if (inUse) {
      g.lineStyle(3, themeColors().accent, 1);
      g.strokeRoundedRect(-CARD_W / 2 + 1.5, -CARD_H / 2 + 1.5, CARD_W - 3, CARD_H - 3, 17);
    }
    card.add(g);

    // Preview band: the theme's AI backdrop when it exists (cover-cropped,
    // masked to the rounded card top), else the two-band gradient above.
    const bgKey = resolveThemeBg(theme.id, (key) => this.textures.exists(key) && !this.failedSprites.has(key));
    if (bgKey) {
      // Add to the card (not the scene) so the character preview draws on top.
      const img = this.add.image(0, -CARD_H / 2 + PREVIEW_H / 2, bgKey);
      img.setScale(Math.max((CARD_W - 6) / img.width, (PREVIEW_H - 6) / img.height));
      const maskG = this.make.graphics({ x: 0, y: 0 }, false);
      maskG.fillRoundedRect(x - CARD_W / 2 + 3, y - CARD_H / 2 + 3, CARD_W - 6, PREVIEW_H - 6, { tl: 15, tr: 15, bl: 0, br: 0 });
      img.setMask(maskG.createGeometryMask());
      card.add(img);
    }

    // Character sprite preview; each theme shows its own sprite when loaded.
    // The base edition (sky) previews the naive AI yellow block when present,
    // else the v1 procedural yellow block; other themes fall back to an
    // octagon while their art is missing.
    const hasSprite = this.textures.exists(theme.sprite) && !this.failedSprites.has(theme.sprite);
    if (hasSprite) {
      card.add(this.add.image(0, -CARD_H / 2 + PREVIEW_H / 2, theme.sprite).setDisplaySize(76, 76));
    } else if (theme.id === 'sky') {
      card.add(this.add.image(0, -CARD_H / 2 + PREVIEW_H / 2, TEX.player).setTint(0xffdd00).setDisplaySize(56, 56));
    } else {
      card.add(this.add.image(0, -CARD_H / 2 + PREVIEW_H / 2, tileTexture(4)).setTint(theme.colors.tile).setDisplaySize(64, 64));
    }

    // Name + status on the lower band; each palette's textPrimary stays
    // readable on its own bgBottom (dark themes ship light text).
    card.add(this.text(0, 36, theme.name, { size: 19, bold: true, color: theme.colors.textPrimary }));

    if (inUse) {
      card.add(this.text(0, 64, '使用中', { size: 13, bold: true, color: themeColors().accent }));
    } else if (owned) {
      card.add(this.text(0, 64, '可使用', { size: 13, color: theme.colors.textSecondary }));
    } else {
      const affordable = coins >= theme.price;
      const row = this.add.container(0, 64);
      const pg = this.add.graphics();
      pg.fillStyle(0xffb703, affordable ? 1 : 0.4);
      pg.fillCircle(-22, 0, 8);
      pg.fillStyle(0xcc8800, affordable ? 1 : 0.4);
      pg.fillCircle(-22, 0, 4);
      row.add([pg, this.text(-8, 0, String(theme.price), { size: 14, bold: true, align: 'left', color: affordable ? 0xcc8800 : 0x9aa5b5 })]);
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
    return card;
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
    modal.panel.add(this.text(0, -60, `需要 ${theme.price} 金币（当前 ${coins}）`, { size: 18, bold: true, color: themeColors().panelText }));
    modal.panel.add(this.text(0, -26, coins >= theme.price ? '解锁后立即应用该皮肤主题。' : '金币不足，去闯关或每日挑战赚取吧！', { size: 14, color: themeColors().textSecondary }));
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
        this.time.delayedCall(700, () => runAchievementsCheck(this));
        this.time.delayedCall(450, () => this.refresh());
      },
    });
    const cancel = new Button(this, 0, 118, { label: '取消', variant: 'secondary', width: 280, height: 52, onClick: () => modal.close() });
    modal.panel.add([buy, cancel]);
  }
}
