import Phaser from 'phaser';
import { getCampaignLevel } from '../../core/levels';
import { DEPTH } from '../config/layout';
import { themeColors } from '../config/themes';
import { tileTexture } from '../rendering/textures';
import { autoPromptInstallIfDue } from '../ui/installPrompt';
import { Button } from '../ui/Button';
import { BaseScene } from './BaseScene';

/** Title screen: campaign entry, level select / daily, endless, help/settings. */
export class HomeScene extends BaseScene {
  constructor() {
    super('HomeScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();
    const COLORS = themeColors();

    const cx = this.W / 2;
    const save = this.svc.save.get();
    const nextLevel = Math.min(save.campaign.unlockedLevel, 30);

    // Coin badge, top-right: gold disc + current balance in a capsule.
    const badgeText = this.text(0, 0, String(save.economy.coins), { size: 15, bold: true, align: 'left' });
    const badgeW = badgeText.width + 56;
    const badge = this.add.container(this.W - 16 - badgeW, 16);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.12);
    bg.fillRoundedRect(0, 3, badgeW, 34, 17);
    bg.fillStyle(0xffffff, 0.88);
    bg.fillRoundedRect(0, 0, badgeW, 34, 17);
    bg.fillStyle(0xffb703, 1);
    bg.fillCircle(19, 17, 10);
    bg.fillStyle(0xcc8800, 1);
    bg.fillCircle(19, 17, 5);
    badgeText.setPosition(36, 17);
    badge.add([bg, badgeText]);
    badge.setDepth(DEPTH.hud);

    // Ambient octagon decorations: different stack thicknesses, low alpha,
    // slow rotate + drift, looping forever.
    const decos = [
      { x: cx + 172, y: 148, tex: tileTexture(5), alpha: 0.5, angle: 12, dy: 16, dur: 2600 },
      { x: cx - 180, y: 220, tex: tileTexture(3), alpha: 0.4, angle: -14, dy: 14, dur: 3200 },
      { x: cx + 196, y: 400, tex: tileTexture(7), alpha: 0.32, angle: 24, dy: 18, dur: 3800 },
      { x: cx - 196, y: 520, tex: tileTexture(2), alpha: 0.28, angle: -20, dy: 12, dur: 3000 },
    ];
    for (const d of decos) {
      const img = this.add.image(d.x, d.y, d.tex).setTint(COLORS.tile).setAlpha(0).setAngle(d.angle);
      this.tweens.add({ targets: img, alpha: d.alpha, duration: 700, delay: 200 });
      this.tweens.add({ targets: img, angle: -d.angle, y: d.y + d.dy, duration: d.dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Title with a slow +-6px float (started after the entrance settles).
    const title = this.text(cx, 158, '瓦片破坏者', { size: 52, bold: true });
    this.tweens.add({ targets: title, y: 146, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 820 });
    const subtitle = this.text(cx, 208, 'HEX BREAKER · 街机射击', { size: 18, color: COLORS.textSecondary });

    // Records as two side-by-side capsules.
    const capsule = (x: number, label: string, value: string): Phaser.GameObjects.Container => {
      const c = this.add.container(x, 306);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.12);
      g.fillRoundedRect(-95, -37, 190, 84, 22);
      g.fillStyle(0xffffff, 0.85);
      g.fillRoundedRect(-95, -42, 190, 84, 22);
      const l = this.text(0, -16, label, { size: 14, color: COLORS.textSecondary });
      const v = this.text(0, 14, value, { size: 30, bold: true });
      c.add([g, l, v]);
      return c;
    };
    const capScore = capsule(cx - 102, '无尽最高分', String(save.highScore));
    const capLevel = capsule(cx + 102, '闯关进度', `Lv${save.campaign.unlockedLevel}`);

    // Button ladder: campaign primary, select/daily pair, endless secondary,
    // then help/settings as quiet ghost links.
    const startY = Math.min(this.H - 470, 432);
    const campaignBtn = new Button(this, cx, startY, {
      label: `继续闯关 Lv${nextLevel}`,
      width: 320,
      height: 72,
      fontSize: 22,
      onClick: () => this.go('GameScene', { mode: 'level', level: getCampaignLevel(nextLevel) }),
    });
    const selectBtn = new Button(this, cx - 82, startY + 92, {
      label: '选关',
      variant: 'secondary',
      width: 150,
      height: 60,
      onClick: () => this.go('LevelSelectScene'),
    });
    const dailyBtn = new Button(this, cx + 82, startY + 92, {
      label: '每日挑战',
      variant: 'secondary',
      width: 150,
      height: 60,
      onClick: () => this.go('DailyScene'),
    });
    const endlessBtn = new Button(this, cx, startY + 168, {
      label: '无尽模式',
      variant: 'secondary',
      width: 320,
      height: 60,
      onClick: () => this.go('GameScene', { mode: 'endless' }),
    });
    const boardBtn = new Button(this, cx - 76, startY + 246, {
      label: '排行',
      variant: 'ghost',
      width: 140,
      height: 46,
      fontSize: 16,
      onClick: () => this.go('LeaderboardScene'),
    });
    const themeBtn = new Button(this, cx + 76, startY + 246, {
      label: '主题',
      variant: 'ghost',
      width: 140,
      height: 46,
      fontSize: 16,
      onClick: () => this.go('ThemeScene'),
    });
    const achBtn = new Button(this, cx - 76, startY + 300, {
      label: '成就',
      variant: 'ghost',
      width: 140,
      height: 46,
      fontSize: 16,
      onClick: () => this.go('AchievementScene'),
    });
    const helpBtn = new Button(this, cx + 76, startY + 300, {
      label: '玩法说明',
      variant: 'ghost',
      width: 140,
      height: 46,
      fontSize: 16,
      onClick: () => this.go('HelpScene'),
    });
    const settingsBtn = new Button(this, cx, startY + 354, {
      label: '设置',
      variant: 'ghost',
      width: 140,
      height: 46,
      fontSize: 16,
      onClick: () => this.go('SettingsScene'),
    });

    const version = this.text(cx, this.H - 36, `v${__APP_VERSION__}`, { size: 13, color: COLORS.textSecondary, alpha: 0.7 });

    autoPromptInstallIfDue(this);

    // Entrance: staggered fade + 12px rise into place.
    const entrance: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [
      title,
      subtitle,
      capScore,
      capLevel,
      campaignBtn,
      selectBtn,
      dailyBtn,
      endlessBtn,
      boardBtn,
      themeBtn,
      achBtn,
      helpBtn,
      settingsBtn,
      version,
    ];
    entrance.forEach((obj, i) => {
      const finalY = obj.y;
      obj.y = finalY + 12;
      obj.setAlpha(0);
      this.tweens.add({ targets: obj, y: finalY, alpha: 1, duration: 300, delay: 100 + i * 55, ease: 'Quad.easeOut' });
    });
  }
}
