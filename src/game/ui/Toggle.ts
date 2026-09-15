import Phaser from 'phaser';
import { COLORS } from '../config/layout';
import { services } from '../services';

export interface ToggleOptions {
  value: boolean;
  onChange: (value: boolean) => void;
}

/** iOS-style pill switch. */
export class Toggle extends Phaser.GameObjects.Container {
  private value: boolean;
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ToggleOptions) {
    super(scene, x, y);
    this.value = opts.value;
    this.track = scene.add.graphics();
    this.add(this.track);
    this.knob = scene.add.circle(0, 0, 14, 0xffffff);
    this.add(this.knob);
    this.redraw(false);
    this.setSize(72, 40);
    // See Button.ts: the hit area must be top-left-anchored, not centred.
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, 72, 40), Phaser.Geom.Rectangle.Contains);
    this.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() > 14) return;
      this.value = !this.value;
      services().audio.button();
      this.redraw(true);
      opts.onChange(this.value);
    });
    scene.add.existing(this);
  }

  private redraw(animate: boolean): void {
    this.track.clear();
    this.track.fillStyle(this.value ? COLORS.accent : 0x9aa5b5, 1);
    this.track.fillRoundedRect(-36, -18, 72, 36, 18);
    const target = this.value ? 18 : -18;
    if (animate) this.scene.tweens.add({ targets: this.knob, x: target, duration: 140, ease: 'Quad.easeOut' });
    else this.knob.x = target;
  }

  getValue(): boolean {
    return this.value;
  }
}
