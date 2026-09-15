import { themeColors } from '../config/themes';
import { ensureTextures, tileTexture } from '../rendering/textures';
import { BaseScene } from './BaseScene';

/** Registry flag set when assets/player-ship.png could not be loaded. */
export const SHIP_LOAD_FAILED_KEY = 'shipLoadFailed';
/** Texture key of the optional player ship image. */
export const SHIP_TEXTURE_KEY = 'ship';

/**
 * Generates every procedural texture, loads the optional player ship image
 * (graceful: a missing file just keeps the procedural fallback), shows a
 * small logo + loading hint for a beat, then hands over to HomeScene.
 */
export class BootScene extends BaseScene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    ensureTextures(this);
    const COLORS = themeColors();
    this.cameras.main.setBackgroundColor(COLORS.bgTop);

    const cx = this.W / 2;
    const cy = this.H / 2;
    const logo = this.add.image(cx, cy - 70, tileTexture(4)).setTint(COLORS.tile).setDisplaySize(96, 96);
    this.tweens.add({ targets: logo, y: cy - 80, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.text(cx, cy + 14, '瓦片破坏者', { size: 34, bold: true });
    const hint = this.text(cx, this.H - 140, '正在加载…', { size: 14, color: COLORS.textSecondary }).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 0.85, duration: 320 });

    // Optional ship art; a 404 is fine and only sets the fallback flag.
    this.load.image(SHIP_TEXTURE_KEY, 'assets/player-ship.png');
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === SHIP_TEXTURE_KEY) this.registry.set(SHIP_LOAD_FAILED_KEY, true);
    });

    // Hand over once the loader is done AND the 500ms logo beat has played.
    let loaded = false;
    let beatDone = false;
    let started = false;
    const tryStart = (): void => {
      if (!loaded || !beatDone || started) return;
      started = true;
      this.scene.start('HomeScene');
    };
    this.load.on('complete', () => {
      loaded = true;
      tryStart();
    });
    this.time.delayedCall(500, () => {
      beatDone = true;
      tryStart();
    });
    this.load.start();
  }
}
