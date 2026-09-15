import Phaser from 'phaser';
import { COLORS, css, DEPTH, DESIGN_WIDTH, FONT_FAMILY, MIN_DESIGN_HEIGHT } from '../config/layout';
import { ensureTextures } from '../rendering/textures';
import { services } from '../services';
import type { Services } from '../services';
import { Background } from '../ui/Background';

export interface TextOptions {
  size?: number;
  color?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  alpha?: number;
  lineSpacing?: number;
}

/** Registry key BaseScene uses to tell the next create() not to fade in. */
const SKIP_FADE_KEY = '__skipFadeIn';

/**
 * Shared scene plumbing: design-unit camera (zoomed by the device pixel
 * ratio), crisp text creation and fade transitions.
 */
export abstract class BaseScene extends Phaser.Scene {
  protected readonly W = DESIGN_WIDTH;
  protected H = MIN_DESIGN_HEIGHT;
  protected dpr = 1;
  protected svc!: Services;
  private transitioning = false;
  private skipFadeIn = false;

  init(_data?: unknown): void {
    this.svc = services();
    this.dpr = (this.registry.get('dpr') as number | undefined) ?? 1;
    this.H = (this.registry.get('designHeight') as number | undefined) ?? MIN_DESIGN_HEIGHT;
    const cam = this.cameras.main;
    cam.setZoom(this.dpr);
    cam.centerOn(this.W / 2, this.H / 2);
    cam.setRoundPixels(false);
    this.transitioning = false;
    // Consume the flag refresh() may have left: a fresh camera has no fade
    // effect running, so fadeIn() would still paint one black frame.
    this.skipFadeIn = this.registry.get(SKIP_FADE_KEY) === true;
    this.registry.remove(SKIP_FADE_KEY);
    ensureTextures(this);
  }

  protected addBackground(): Background {
    const bg = new Background(this, this.W, this.H);
    bg.setDepth(DEPTH.background);
    return bg;
  }

  protected fadeIn(duration = 180): void {
    if (this.skipFadeIn) return;
    this.cameras.main.fadeIn(duration, 0, 0, 0);
  }

  /** Fade out then start another scene. Ignored while a transition runs. */
  protected go(key: string, data?: object, duration = 160): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.input.enabled = false;
    this.cameras.main.fadeOut(duration, 0, 0, 0);
    this.time.delayedCall(duration, () => {
      this.scene.start(key, data);
    });
  }

  /** Redraw the same scene without go()'s black fade. */
  protected refresh(data?: object): void {
    this.registry.set(SKIP_FADE_KEY, true);
    this.scene.restart(data);
  }

  text(x: number, y: number, content: string, opts: TextOptions = {}): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: `${opts.size ?? 20}px`,
      color: css(opts.color ?? COLORS.textPrimary),
      fontStyle: opts.bold ? 'bold' : 'normal',
      align: opts.align ?? 'center',
      resolution: this.dpr,
    };
    if (opts.wrap) style.wordWrap = { width: opts.wrap, useAdvancedWrap: true };
    const t = this.add.text(x, y, content, style);
    t.setOrigin(opts.align === 'left' ? 0 : opts.align === 'right' ? 1 : 0.5, 0.5);
    if (opts.alpha !== undefined) t.setAlpha(opts.alpha);
    if (opts.lineSpacing) t.setLineSpacing(opts.lineSpacing);
    return t;
  }

  protected roundedRect(x: number, y: number, w: number, h: number, r: number, fill: number, alpha = 1, stroke?: { width: number; color: number; alpha?: number }): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(fill, alpha);
    g.fillRoundedRect(x, y, w, h, r);
    if (stroke) {
      g.lineStyle(stroke.width, stroke.color, stroke.alpha ?? 1);
      g.strokeRoundedRect(x, y, w, h, r);
    }
    return g;
  }
}
