import Phaser from 'phaser';
import { formatTimeMs } from '../../core/format';
import { dailyLevel, utcDateKey } from '../../core/levels';
import { COLORS } from '../config/layout';
import { TEX } from '../rendering/textures';
import { Button } from '../ui/Button';
import { BaseScene } from './BaseScene';

/**
 * Daily challenge lobby: today's seed-derived level card (target, difficulty,
 * personal best, streak) and the start button. Everyone gets the same board.
 */
export class DailyScene extends BaseScene {
  constructor() {
    super('DailyScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();

    const cx = this.W / 2;
    this.text(cx, 62, '每日挑战', { size: 34, bold: true });

    const dateKey = utcDateKey();
    const level = dailyLevel(dateKey);
    const daily = this.svc.save.get().daily;

    // Central card.
    const cardW = this.W - 80;
    const cardH = 430;
    const cardY = 120;
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.12);
    card.fillRoundedRect(40, cardY + 5, cardW, cardH, 24);
    card.fillStyle(0xffffff, 1);
    card.fillRoundedRect(40, cardY, cardW, cardH, 24);

    let y = cardY + 52;
    this.text(cx, y, `📅 ${dateKey}`, { size: 20, bold: true });
    y += 46;
    this.text(cx, y, `目标：消灭 ${level.targetKills} 块瓦片`, { size: 24, bold: true });
    y += 34;
    this.text(cx, y, `难度 Lv${level.virtualLevel} · 道具池 Lv${level.itemTierCap}`, { size: 15, color: COLORS.textSecondary });
    y += 52;

    // Personal best (stars + time) for the current daily epoch.
    if (daily.bestStars > 0 || daily.bestTimeMs > 0) {
      const row = this.add.container(cx, y);
      row.add(this.text(-58, 0, '历史最佳', { size: 15, color: COLORS.textSecondary, align: 'right' }));
      for (let i = 0; i < 3; i++) {
        const star = this.add.image(-34 + i * 26, 0, TEX.glyphStar);
        star.setDisplaySize(20, 20);
        if (i < daily.bestStars) star.setTint(0xffb703);
        else star.setTint(0x17364f).setAlpha(0.15);
        row.add(star);
      }
      row.add(this.text(74, 0, formatTimeMs(daily.bestTimeMs), { size: 15, bold: true, align: 'left' }));
    } else {
      this.text(cx, y, '今天还没有成绩，来打第一局！', { size: 15, color: COLORS.textSecondary });
    }
    y += 44;
    const streak = this.text(cx, y, `🔥 连续打卡 ${daily.streak} 天`, { size: 19, bold: true, color: daily.streak > 0 ? 0xe8590c : COLORS.textSecondary });
    if (daily.streak > 0) {
      this.tweens.add({ targets: streak, scaleX: 1.06, scaleY: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    y += 56;
    new Button(this, cx, y, {
      label: '开始挑战',
      width: 300,
      height: 64,
      fontSize: 22,
      onClick: () => this.go('GameScene', { mode: 'daily', level, dateKey }),
    });
    y += 52;
    this.text(cx, y, '所有玩家今天面对相同的关卡', { size: 13, color: COLORS.textSecondary, alpha: 0.85 });

    new Button(this, cx, this.H - 56, { label: '返回主页', variant: 'secondary', width: 320, height: 60, onClick: () => this.go('HomeScene') });
    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }
}
