import Phaser from 'phaser';
import { css, DEPTH, FONT_FAMILY } from '../config/layout';
import { themeColors } from '../config/themes';

export interface ModalOptions {
  width?: number;
  height?: number;
  title?: string;
  closeOnOverlay?: boolean;
  onClose?: () => void;
  depth?: number;
}

/**
 * Dimmed overlay + centred rounded panel. Content is added to `panel` using
 * coordinates relative to the panel centre.
 */
export class Modal extends Phaser.GameObjects.Container {
  readonly panel: Phaser.GameObjects.Container;
  readonly panelWidth: number;
  readonly panelHeight: number;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private closed = false;

  constructor(scene: Phaser.Scene, designWidth: number, designHeight: number, opts: ModalOptions = {}) {
    super(scene, 0, 0);
    const COLORS = themeColors();
    this.panelWidth = opts.width ?? 440;
    this.panelHeight = opts.height ?? 420;
    this.setDepth(opts.depth ?? DEPTH.modal);
    this.overlay = scene.add.rectangle(designWidth / 2, designHeight / 2, designWidth, designHeight, COLORS.overlay, 0.6);
    this.overlay.setInteractive();
    if (opts.closeOnOverlay) this.overlay.on('pointerup', () => this.close());
    this.add(this.overlay);

    this.panel = scene.add.container(designWidth / 2, designHeight / 2);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-this.panelWidth / 2, -this.panelHeight / 2 + 10, this.panelWidth, this.panelHeight, 30);
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(-this.panelWidth / 2, -this.panelHeight / 2, this.panelWidth, this.panelHeight, 30);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeRoundedRect(-this.panelWidth / 2, -this.panelHeight / 2, this.panelWidth, this.panelHeight, 30);
    this.panel.add(g);
    // The panel itself swallows clicks so they never reach the overlay.
    const blocker = scene.add.zone(0, 0, this.panelWidth, this.panelHeight).setInteractive();
    this.panel.add(blocker);
    if (opts.title) {
      const dpr = (scene.registry.get('dpr') as number | undefined) ?? 1;
      const t = scene.add.text(0, -this.panelHeight / 2 + 46, opts.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: 'bold',
        color: css(COLORS.panelText),
        resolution: dpr,
      });
      t.setOrigin(0.5);
      this.panel.add(t);
    }
    this.add(this.panel);
    scene.add.existing(this);

    this.overlay.setAlpha(0);
    this.panel.setScale(0.88);
    this.panel.setAlpha(0);
    scene.tweens.add({ targets: this.overlay, alpha: 0.6, duration: 160 });
    scene.tweens.add({ targets: this.panel, scaleX: 1, scaleY: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.once('destroy', () => opts.onClose?.());
  }

  close(onDone?: () => void): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.tweens.add({ targets: this.overlay, alpha: 0, duration: 140 });
    this.scene.tweens.add({
      targets: this.panel,
      scaleX: 0.9,
      scaleY: 0.9,
      alpha: 0,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.destroy();
        onDone?.();
      },
    });
  }
}
