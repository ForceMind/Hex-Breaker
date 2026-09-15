import Phaser from 'phaser';
import { themeColors } from '../config/themes';
import { TEX } from '../rendering/textures';

/** Banded vertical gradient plus a few slowly drifting soft shapes. */
export class Background extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene, 0, 0);
    const COLORS = themeColors();
    const g = scene.add.graphics();
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
    const rng = new Phaser.Math.RandomDataGenerator([String(COLORS.bgTop)]);
    for (let i = 0; i < 5; i++) {
      const s = scene.add.image(rng.between(0, width), rng.between(0, height), TEX.softCircle);
      s.setTint(COLORS.decor);
      s.setAlpha(rng.realInRange(0.08, 0.18));
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
