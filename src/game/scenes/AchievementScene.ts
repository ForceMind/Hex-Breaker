import Phaser from 'phaser';
import { ACHIEVEMENTS, type AchievementDef } from '../../core/achievements';
import { DEPTH } from '../config/layout';
import { themeColors } from '../config/themes';
import { Button } from '../ui/Button';
import { BaseScene } from './BaseScene';

const ROW_H = 64;
const ROW_GAP = 10;
const CARD_X = 24;
const LIST_TOP = 150;

/**
 * Achievement gallery: one scrollable list of all achievements, unlocked ones
 * bright with a gold medal + unlock date, locked ones dimmed with their coin
 * reward shown as the incentive. Header shows overall completion.
 *
 * Per the project's art principle the visuals are procedural only (rounded
 * rects + tint), recoloured by the active theme — no dedicated artwork.
 */
export class AchievementScene extends BaseScene {
  constructor() {
    super('AchievementScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();
    const COLORS = themeColors();

    const cx = this.W / 2;
    const save = this.svc.save.get();
    const unlocked = save.achievements;
    const doneCount = ACHIEVEMENTS.filter((a) => unlocked[a.id] !== undefined).length;

    this.text(cx, 58, '成就', { size: 32, bold: true });

    // Progress capsule under the title.
    const progW = 240;
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.12);
    pg.fillRoundedRect(cx - progW / 2, 92 + 3, progW, 30, 15);
    pg.fillStyle(0xffffff, 0.88);
    pg.fillRoundedRect(cx - progW / 2, 92, progW, 30, 15);
    const ratio = doneCount / ACHIEVEMENTS.length;
    if (ratio > 0) {
      pg.fillStyle(COLORS.accent, 1);
      pg.fillRoundedRect(cx - progW / 2 + 3, 95, Math.max(24, (progW - 6) * ratio), 24, 12);
    }
    this.text(cx, 107, `${doneCount} / ${ACHIEVEMENTS.length}`, { size: 14, bold: true });

    // Scrollable list inside a fixed window between the header and the button.
    const listBottom = this.H - 130;
    const viewH = listBottom - LIST_TOP;
    const contentH = ACHIEVEMENTS.length * (ROW_H + ROW_GAP);

    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillRect(0, LIST_TOP, this.W, viewH);
    const mask = maskG.createGeometryMask();

    const list = this.add.container(0, 0);
    list.setMask(mask);
    list.setDepth(DEPTH.tiles);

    ACHIEVEMENTS.forEach((def, i) => {
      list.add(this.buildRow(def, LIST_TOP + i * (ROW_H + ROW_GAP), unlocked[def.id]));
    });

    // Drag-to-scroll (pointer wheel on desktop too).
    if (contentH > viewH) {
      const minY = -(contentH - viewH);
      let dragging = false;
      let startY = 0;
      let startListY = 0;
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.y < LIST_TOP || p.y > listBottom) return;
        dragging = true;
        startY = p.y;
        startListY = list.y;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!dragging || !p.isDown) return;
        list.y = Phaser.Math.Clamp(startListY + (p.y - startY), minY, 0);
      });
      const stop = (): void => {
        dragging = false;
      };
      this.input.on('pointerup', stop);
      this.input.on('pointerupoutside', stop);
      this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        list.y = Phaser.Math.Clamp(list.y - dy * 0.5, minY, 0);
      });
    }

    new Button(this, cx, this.H - 56, { label: '返回主页', variant: 'secondary', width: 320, height: 60, onClick: () => this.go('HomeScene') });
    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }

  private buildRow(def: AchievementDef, y: number, unlockedAt: number | undefined): Phaser.GameObjects.Container {
    const COLORS = themeColors();
    const isDone = unlockedAt !== undefined;
    const cardW = this.W - CARD_X * 2;
    const row = this.add.container(0, 0);

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(CARD_X, y + 3, cardW, ROW_H, 14);
    g.fillStyle(0xffffff, isDone ? 0.92 : 0.62);
    g.fillRoundedRect(CARD_X, y, cardW, ROW_H, 14);
    if (isDone) {
      g.lineStyle(1.5, COLORS.accent, 0.7);
      g.strokeRoundedRect(CARD_X + 0.75, y + 0.75, cardW - 1.5, ROW_H - 1.5, 13);
    }
    row.add(g);

    // Medal disc: gold when unlocked, hollow grey when locked.
    const mx = CARD_X + 34;
    const my = y + ROW_H / 2;
    const medal = this.add.graphics();
    if (isDone) {
      medal.fillStyle(0xffb703, 1);
      medal.fillCircle(mx, my, 18);
      medal.fillStyle(0xcc8800, 1);
      medal.fillCircle(mx, my, 10);
    } else {
      medal.lineStyle(2, 0x9aa5b5, 0.9);
      medal.strokeCircle(mx, my, 17);
    }
    row.add(medal);
    if (isDone) row.add(this.text(mx, my - 1, '✓', { size: 17, bold: true, color: 0xffffff }));

    const tx = CARD_X + 66;
    row.add(this.text(tx, y + 20, def.name, { size: 17, bold: true, align: 'left', color: isDone ? COLORS.textPrimary : 0x5a6a7a }));
    row.add(this.text(tx, y + 45, def.description, { size: 12, align: 'left', color: isDone ? COLORS.textSecondary : 0x8a97a5 }));

    // Right side: reward (locked) or unlock date (done).
    if (isDone) {
      const d = new Date(unlockedAt);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      row.add(this.text(CARD_X + cardW - 16, y + ROW_H / 2, dateStr, { size: 12, align: 'right', color: COLORS.textSecondary }));
    } else {
      const rg = this.add.graphics();
      rg.fillStyle(0xffb703, 0.85);
      rg.fillCircle(CARD_X + cardW - 52, y + ROW_H / 2, 7);
      rg.fillStyle(0xcc8800, 0.85);
      rg.fillCircle(CARD_X + cardW - 52, y + ROW_H / 2, 3.5);
      row.add(rg);
      row.add(this.text(CARD_X + cardW - 38, y + ROW_H / 2, String(def.reward), { size: 13, bold: true, align: 'left', color: 0xcc8800 }));
    }
    return row;
  }
}
