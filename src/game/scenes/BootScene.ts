import { themeColors, THEME_IDS, playerSpriteKey } from '../config/themes';
import { ensureTextures, tileTexture } from '../rendering/textures';
import { BaseScene } from './BaseScene';

/** Registry key holding the list of player-sprite keys that failed to load. */
export const PLAYER_TEX_FAILED_KEY = 'playerTexFailed';

/**
 * Generates every procedural texture, loads the eight optional player-sprite
 * images (graceful: missing files are recorded per key and the game falls
 * back along theme -> sky -> procedural), shows a small logo + loading hint
 * for a beat, then hands over to HomeScene.
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

    // Optional per-theme player art; 404s only grow the failure list.
    for (const id of THEME_IDS) {
      this.load.image(playerSpriteKey(id), `assets/player-${id}.png`);
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (!file.key.startsWith('player-')) return;
      const failed = (this.registry.get(PLAYER_TEX_FAILED_KEY) as string[] | undefined) ?? [];
      this.registry.set(PLAYER_TEX_FAILED_KEY, [...failed, file.key]);
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

