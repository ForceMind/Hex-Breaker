import type Phaser from 'phaser';
import { COLORS, css, DEPTH, FONT_FAMILY } from '../config/layout';

/** Short transient message; a scene keeps at most one visible at a time. */
export function showToast(scene: Phaser.Scene, x: number, y: number, message: string, duration = 1400): void {
  const dpr = (scene.registry.get('dpr') as number | undefined) ?? 1;
  const existing = scene.children.getByName('toast');
  existing?.destroy();
  const container = scene.add.container(x, y).setName('toast').setDepth(DEPTH.toast);
  const text = scene.add.text(0, 0, message, {
    fontFamily: FONT_FAMILY,
    fontSize: '20px',
    color: css(COLORS.panelText),
    fontStyle: 'bold',
    resolution: dpr,
    align: 'center',
    wordWrap: { width: 420 },
  });
  text.setOrigin(0.5);
  const w = text.width + 44;
  const h = text.height + 24;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.2);
  g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 18);
  g.fillStyle(COLORS.panel, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  container.add([g, text]);
  container.setAlpha(0);
  container.y = y + 12;
  scene.tweens.add({ targets: container, alpha: 1, y, duration: 160, ease: 'Quad.easeOut' });
  scene.tweens.add({
    targets: container,
    alpha: 0,
    y: y - 10,
    delay: duration,
    duration: 220,
    onComplete: () => container.destroy(),
  });
}
