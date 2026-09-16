import Phaser from 'phaser';
import { css, FONT_FAMILY } from '../config/layout';
import { themeColors } from '../config/themes';
import { services } from '../services';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonOptions {
  width?: number;
  height?: number;
  label?: string;
  variant?: ButtonVariant;
  fontSize?: number;
  radius?: number;
  fill?: number;
  textColor?: number;
  onClick: () => void;
  enabled?: boolean;
  silent?: boolean;
}

/**
 * Rounded button drawn with Graphics. Press feedback: scale down, then click
 * on release if the pointer stayed close to where it went down (so drags
 * never trigger clicks).
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text | null = null;
  private readonly btnW: number;
  private readonly btnH: number;
  private pressed = false;
  private enabled: boolean;
  private readonly opts: ButtonOptions;
  private fillColor: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    this.opts = opts;
    this.btnW = opts.width ?? 260;
    this.btnH = opts.height ?? 64;
    const variant = opts.variant ?? 'primary';
    const COLORS = themeColors();
    const fills: Record<ButtonVariant, number> = {
      primary: COLORS.button,
      secondary: COLORS.buttonSecondary,
      ghost: COLORS.buttonSecondary,
      danger: COLORS.danger,
    };
    const texts: Record<ButtonVariant, number> = {
      primary: COLORS.buttonText,
      secondary: COLORS.textPrimary,
      ghost: COLORS.accent,
      danger: 0xffffff,
    };
    this.fillColor = opts.fill ?? fills[variant];
    const textColor = opts.textColor ?? texts[variant];
    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.enabled = opts.enabled ?? true;
    this.drawBg(variant);

    if (opts.label) {
      const dpr = (scene.registry.get('dpr') as number | undefined) ?? 1;
      const t = scene.add.text(0, 0, opts.label, {
        fontFamily: FONT_FAMILY,
        fontSize: `${opts.fontSize ?? 22}px`,
        color: css(textColor),
        fontStyle: 'bold',
        resolution: dpr,
      });
      t.setOrigin(0.5);
      this.add(t);
      this.labelText = t;
    }
    this.setSize(this.btnW, this.btnH);
    // Container hit-testing adds displayOrigin (w/2, h/2) to the local point,
    // so the hit area must be top-left-anchored (0, 0, w, h), not centred.
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.btnW, this.btnH), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      scene.tweens.killTweensOf(this);
      scene.tweens.add({ targets: this, scaleX: 0.94, scaleY: 0.94, duration: 70, ease: 'Quad.easeOut' });
    });
    const release = (): void => {
      if (!this.pressed) return;
      this.pressed = false;
      scene.tweens.killTweensOf(this);
      scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
    };
    this.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.pressed) return;
      release();
      if (pointer.getDistance() > 14) return;
      if (!opts.silent) services().audio.button();
      services().vibration.tap();
      opts.onClick();
    });
    this.on('pointerout', release);
    this.on('pointerupoutside', release);
    if (!this.enabled) this.setAlpha(0.45);
    scene.add.existing(this);
  }

  private drawBg(variant: ButtonVariant): void {
    const r = this.opts.radius ?? Math.min(this.btnH / 2, 20);
    const g = this.bg;
    const COLORS = themeColors();
    g.clear();
    if (variant !== 'ghost') {
      g.fillStyle(0x000000, 0.14);
      g.fillRoundedRect(-this.btnW / 2, -this.btnH / 2 + 4, this.btnW, this.btnH, r);
    }
    // Ghost = outlined white chip (accent frame), NOT a dimmed fill: dimming
    // read as "disabled". Disabled state still dims (see setEnabled).
    g.fillStyle(this.fillColor, variant === 'ghost' ? 0.92 : 1);
    g.fillRoundedRect(-this.btnW / 2, -this.btnH / 2, this.btnW, this.btnH, r);
    if (variant === 'primary' || variant === 'danger') {
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(-this.btnW / 2 + 4, -this.btnH / 2 + 3, this.btnW - 8, this.btnH / 2 - 4, { tl: r - 2, tr: r - 2, bl: 6, br: 6 });
    } else if (variant === 'ghost') {
      g.lineStyle(2, COLORS.accent, 0.9);
      g.strokeRoundedRect(-this.btnW / 2 + 1, -this.btnH / 2 + 1, this.btnW - 2, this.btnH - 2, r - 1);
    } else {
      g.lineStyle(2, 0x17364f, 0.15);
      g.strokeRoundedRect(-this.btnW / 2, -this.btnH / 2, this.btnW, this.btnH, r);
    }
  }

  setLabel(text: string): this {
    this.labelText?.setText(text);
    return this;
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.setAlpha(v ? 1 : 0.45);
    return this;
  }

  setFill(color: number): this {
    this.fillColor = color;
    this.drawBg(this.opts.variant ?? 'primary');
    return this;
  }
}
