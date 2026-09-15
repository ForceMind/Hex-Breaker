import Phaser from 'phaser';
import { CAMPAIGN_LEVELS, type LevelDef } from '../../core/levels';
import { COLORS } from '../config/layout';
import { TEX } from '../rendering/textures';
import { Button } from '../ui/Button';
import { BaseScene } from './BaseScene';

const COLS = 5;
const CARD_W = 88;
const CARD_H = 72;
const GAP = 10;
const GRID_TOP = 128;

/**
 * 30-level campaign grid (5 x 6): rounded cards with a soft drop shadow, the
 * level number and its earned stars; locked levels are dimmed with a lock,
 * cleared ones get a gold frame.
 */
export class LevelSelectScene extends BaseScene {
  constructor() {
    super('LevelSelectScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();

    const cx = this.W / 2;
    this.text(cx, 62, '选择关卡', { size: 34, bold: true });

    const save = this.svc.save.get();
    const unlocked = save.campaign.unlockedLevel;

    const gridW = COLS * CARD_W + (COLS - 1) * GAP;
    const startX = (this.W - gridW) / 2 + CARD_W / 2;

    CAMPAIGN_LEVELS.forEach((level, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (CARD_W + GAP);
      const y = GRID_TOP + row * (CARD_H + GAP) + CARD_H / 2;
      const isUnlocked = level.id <= unlocked;
      const card = this.buildCard(x, y, level, isUnlocked, save.campaign.records[level.id]?.stars ?? 0);
      // Entrance: staggered rise + fade, row by row (locked cards stay dimmed).
      const finalY = card.y;
      card.y = finalY + 14;
      card.setAlpha(0);
      this.tweens.add({ targets: card, y: finalY, alpha: isUnlocked ? 1 : 0.55, duration: 260, delay: 80 + i * 24, ease: 'Quad.easeOut' });
    });

    new Button(this, cx, this.H - 56, { label: '返回主页', variant: 'secondary', width: 320, height: 60, onClick: () => this.go('HomeScene') });
    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }

  private buildCard(x: number, y: number, level: LevelDef, unlocked: boolean, stars: number): Phaser.GameObjects.Container {
    const card = this.add.container(x, y);
    const g = this.add.graphics();
    // drop shadow (y + 4) + face
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 4, CARD_W, CARD_H, 16);
    g.fillStyle(0xffffff, unlocked ? 0.92 : 0.7);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);
    if (stars > 0) {
      // cleared: gold frame
      g.lineStyle(2, 0xffb703, 1);
      g.strokeRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, CARD_W - 2, CARD_H - 2, 15);
    }
    card.add(g);

    card.add(this.text(0, -16, String(level.id), { size: 20, bold: true }));

    if (unlocked) {
      for (let s = 0; s < 3; s++) {
        const star = this.add.image((s - 1) * 24, 16, TEX.glyphStar);
        star.setDisplaySize(18, 18);
        if (s < stars) star.setTint(0xffb703);
        else star.setTint(0x17364f).setAlpha(0.15);
        card.add(star);
      }
    } else {
      card.add(this.text(0, 16, '🔒', { size: 16 }));
    }

    card.setSize(CARD_W, CARD_H);
    card.setInteractive(new Phaser.Geom.Rectangle(0, 0, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    if (unlocked) {
      card.on('pointerdown', () => {
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scaleX: 0.92, scaleY: 0.92, duration: 70, ease: 'Quad.easeOut' });
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
        this.go('GameScene', { mode: 'level', level });
      });
      card.on('pointerout', release);
      card.on('pointerupoutside', release);
    }
    return card;
  }
}
