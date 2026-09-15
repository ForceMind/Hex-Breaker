import { COLORS } from '../config/layout';
import { ensureTextures, tileTexture } from '../rendering/textures';
import { BaseScene } from './BaseScene';

/**
 * Generates every procedural texture, shows a small logo + loading hint for a
 * beat, then hands over to HomeScene.
 */
export class BootScene extends BaseScene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    ensureTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.bgTop);

    const cx = this.W / 2;
    const cy = this.H / 2;
    const logo = this.add.image(cx, cy - 70, tileTexture(4)).setTint(COLORS.tile).setDisplaySize(96, 96);
    this.tweens.add({ targets: logo, y: cy - 80, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.text(cx, cy + 14, '瓦片破坏者', { size: 34, bold: true });
    const hint = this.text(cx, this.H - 140, '正在加载…', { size: 14, color: COLORS.textSecondary }).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 0.85, duration: 320 });

    this.time.delayedCall(500, () => this.scene.start('HomeScene'));
  }
}
