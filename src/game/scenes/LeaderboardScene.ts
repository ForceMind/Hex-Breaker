import Phaser from 'phaser';
import { LEADERBOARD_BOTS, weeklyLeaderboard, type LeaderboardRow } from '../../services/leaderboard';
import { themeColors } from '../config/themes';
import { Button } from '../ui/Button';
import { BaseScene } from './BaseScene';

const TOP_N = 20;
const ROW_H = 30;

/**
 * Simulated endless weekly board: top 20 rows on one compact screen (no
 * scrolling), the player's own high score merged in and highlighted; if they
 * rank outside the top 20 their row is pinned below the list.
 */
export class LeaderboardScene extends BaseScene {
  private countdown!: Phaser.GameObjects.Text;
  private resetMs = 0;

  constructor() {
    super('LeaderboardScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();
    const COLORS = themeColors();

    const cx = this.W / 2;
    this.text(cx, 58, '无尽模式 · 本周榜', { size: 30, bold: true });

    const save = this.svc.save.get();
    const board = weeklyLeaderboard(save.highScore);
    this.resetMs = board.resetMs;
    this.countdown = this.text(cx, 92, '', { size: 13, color: COLORS.textSecondary });
    this.updateCountdown();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateCountdown() });

    // list card
    const cardX = 24;
    const cardW = this.W - 48;
    const listTop = 118;
    const player = board.rows.find((r) => r.isPlayer);
    const showPlayerBelow = !!player && player.rank > TOP_N;
    const cardH = 16 + TOP_N * ROW_H + (showPlayerBelow ? ROW_H + 18 : 0) + 8;
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.12);
    card.fillRoundedRect(cardX, listTop + 5, cardW, cardH, 20);
    card.fillStyle(0xffffff, 0.94);
    card.fillRoundedRect(cardX, listTop, cardW, cardH, 20);

    board.rows.slice(0, TOP_N).forEach((row, i) => {
      this.drawRow(cardX, listTop + 12 + i * ROW_H, cardW, row);
    });

    if (showPlayerBelow && player) {
      const sepY = listTop + 12 + TOP_N * ROW_H + 4;
      const sep = this.add.graphics();
      sep.fillStyle(COLORS.textPrimary, 0.1);
      sep.fillRect(cardX + 20, sepY, cardW - 40, 1);
      this.drawRow(cardX, sepY + 10, cardW, player);
    }

    this.text(cx, listTop + cardH + 26, `共 ${LEADERBOARD_BOTS} 名玩家 · 每周一 0 点（UTC）重置`, { size: 12, color: COLORS.textSecondary, alpha: 0.85 });

    new Button(this, cx, this.H - 56, { label: '返回主页', variant: 'secondary', width: 320, height: 60, onClick: () => this.go('HomeScene') });
    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }

  private drawRow(cardX: number, y: number, cardW: number, row: LeaderboardRow): void {
    const COLORS = themeColors();
    const midY = y + ROW_H / 2;
    if (row.isPlayer) {
      const hl = this.add.graphics();
      hl.fillStyle(COLORS.accent, 0.16);
      hl.fillRoundedRect(cardX + 6, y, cardW - 12, ROW_H, 9);
      hl.lineStyle(1.5, COLORS.accent, 0.8);
      hl.strokeRoundedRect(cardX + 6, y, cardW - 12, ROW_H, 9);
    }
    const rankColor = row.rank <= 3 ? 0xcc8800 : COLORS.textSecondary;
    this.text(cardX + 22, midY, String(row.rank), { size: 15, bold: row.rank <= 3, color: rankColor, align: 'left' });
    this.text(cardX + 62, midY, row.isPlayer ? `${row.name}（我）` : row.name, { size: 15, bold: row.isPlayer ?? false, align: 'left', color: COLORS.panelText });
    this.text(cardX + cardW - 22, midY, String(row.score), { size: 15, bold: row.isPlayer ?? false, align: 'right', color: COLORS.panelText });
  }

  private updateCountdown(): void {
    const ms = Math.max(0, this.resetMs - Date.now());
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hh = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    this.countdown.setText(`本周剩余 ${days} 天 ${hh}:${mm}:${ss}`);
  }
}
