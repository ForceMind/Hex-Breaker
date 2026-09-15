import Phaser from 'phaser';
import { ASSET_TEX_FAILED_KEY } from '../config/assets';
import { activeThemeId, resolveThemeBg, themeColors } from '../config/themes';
import { TEX } from '../rendering/textures';

/** Relative luminance (0..1) of a 0xRRGGBB colour. */
function luminance(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

/**
 * Banded vertical gradient plus a few slowly drifting soft shapes — or, when
 * the active theme ships AI background art, a cover-fitted photo backdrop
 * with a readability scrim and the same drifting shapes at half alpha.
 */
export class Background extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    const COLORS = themeColors();
    const g = scene.add.graphics();

    const failed = new Set((scene.registry.get(ASSET_TEX_FAILED_KEY) as string[] | undefined) ?? []);
    const bgKey = resolveThemeBg(activeThemeId(), (key) => scene.textures.exists(key) && !failed.has(key));

    if (bgKey) {
      // cover-fit the art, then a white (light theme) or black (dark theme)
      // 0.25 scrim so HUD text and tiles stay readable
      const img = scene.add.image(width / 2, height / 2, bgKey);
      img.setScale(Math.max(width / img.width, height / img.height));
      this.add(img);
      const scrimIsWhite = luminance(COLORS.bgTop) > 0.5;
      g.fillStyle(scrimIsWhite ? 0xffffff : 0x000000, 0.25);
      g.fillRect(0, 0, width, height);
      this.add(g);
    } else {
      const bands = 36;
      const top = Phaser.Display.Color.ValueToColor(COLORS.bgTop);
      const bottom = Phaser.Display.Color.ValueToColor(COLORS.bgBottom);
      for (let i = 0; i < bands; i++) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
        const y0 = Math.floor((height * i) / bands);
        const y1 = Math.ceil((height * (i + 1)) / bands);
        g.fillRect(0, y0, width, y1 - y0);
      }
      this.add(g);
    }

    const decorAlpha = bgKey ? 0.5 : 1;
    const rng = new Phaser.Math.RandomDataGenerator([String(COLORS.bgTop)]);
    for (let i = 0; i < 5; i++) {
      const s = scene.add.image(rng.between(0, width), rng.between(0, height), TEX.softCircle);
      s.setTint(COLORS.decor);
      s.setAlpha(rng.realInRange(0.08, 0.18) * decorAlpha);
      s.setScale(rng.realInRange(0.7, 1.6));
      this.add(s);
      scene.tweens.add({
        targets: s,
        x: s.x + rng.between(-60, 60),
        y: s.y + rng.between(-80, 80),
        duration: rng.between(9000, 16000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    scene.add.existing(this);
  }
}
