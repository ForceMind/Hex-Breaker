import Phaser from 'phaser';
import { COLORS } from '../config/layout';
import { tileTexture } from '../rendering/textures';
import { Button } from '../ui/Button';
import { BaseScene } from './BaseScene';

/** Title screen: records, and entries to game / help / settings. */
export class HomeScene extends BaseScene {
  constructor() {
    super('HomeScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();

    const cx = this.W / 2;

    // Ambient octagon decorations: different stack thicknesses, low alpha,
    // slow rotate + drift, looping forever.
    const decos = [
      { x: cx + 172, y: 168, tex: tileTexture(5), alpha: 0.5, angle: 12, dy: 16, dur: 2600 },
      { x: cx - 180, y: 240, tex: tileTexture(3), alpha: 0.4, angle: -14, dy: 14, dur: 3200 },
      { x: cx + 196, y: 430, tex: tileTexture(7), alpha: 0.32, angle: 24, dy: 18, dur: 3800 },
      { x: cx - 196, y: 560, tex: tileTexture(2), alpha: 0.28, angle: -20, dy: 12, dur: 3000 },
    ];
    for (const d of decos) {
      const img = this.add.image(d.x, d.y, d.tex).setTint(COLORS.tile).setAlpha(0).setAngle(d.angle);
      this.tweens.add({ targets: img, alpha: d.alpha, duration: 700, delay: 200 });
      this.tweens.add({ targets: img, angle: -d.angle, y: d.y + d.dy, duration: d.dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Title with a slow +-6px float (started after the entrance settles).
    const title = this.text(cx, 184, '瓦片破坏者', { size: 52, bold: true });
    this.tweens.add({ targets: title, y: 172, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 820 });
    const subtitle = this.text(cx, 234, 'HEX BREAKER · 无尽模式', { size: 18, color: COLORS.textSecondary });

    // Records as two side-by-side capsules.
    const save = this.svc.save.get();
    const capsule = (x: number, label: string, value: string): Phaser.GameObjects.Container => {
      const c = this.add.container(x, 330);
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
    const capScore = capsule(cx - 102, '最高分', String(save.highScore));
    const capLevel = capsule(cx + 102, '最高等级', `Lv${save.bestLevel}`);

    // Button ladder: one tall primary, two slimmer secondaries.
    const startY = Math.min(this.H - 340, 500);
    const startBtn = new Button(this, cx, startY, { label: '开始游戏', width: 320, height: 72, fontSize: 22, onClick: () => this.go('GameScene') });
    const helpBtn = new Button(this, cx, startY + 92, { label: '玩法说明', variant: 'secondary', width: 320, height: 60, onClick: () => this.go('HelpScene') });
    const settingsBtn = new Button(this, cx, startY + 168, { label: '设置', variant: 'secondary', width: 320, height: 60, onClick: () => this.go('SettingsScene') });

    const version = this.text(cx, this.H - 36, `v${__APP_VERSION__}`, { size: 13, color: COLORS.textSecondary, alpha: 0.7 });

    // Entrance: staggered fade + 12px rise into place.
    const entrance: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [
      title,
      subtitle,
      capScore,
      capLevel,
      startBtn,
      helpBtn,
      settingsBtn,
      version,
    ];
    entrance.forEach((obj, i) => {
      const finalY = obj.y;
      obj.y = finalY + 12;
      obj.setAlpha(0);
      this.tweens.add({ targets: obj, y: finalY, alpha: 1, duration: 300, delay: 100 + i * 60, ease: 'Quad.easeOut' });
    });
  }
}
