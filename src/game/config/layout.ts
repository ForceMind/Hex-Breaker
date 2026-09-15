/** Logical design width in points; height adapts to the viewport aspect. */
export const DESIGN_WIDTH = 540;
export const MIN_DESIGN_HEIGHT = 960;
export const MAX_DESIGN_HEIGHT = 1200;
/** Cap the device pixel ratio so 3x/4x phones do not render 4x the pixels. */
export const MAX_DPR = 2;

export const FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif';

export const DEPTH = {
  background: -10,
  tiles: 0,
  items: 5,
  projectiles: 10,
  player: 15,
  effects: 30,
  hud: 40,
  modal: 60,
  toast: 70,
} as const;

/**
 * Single fixed palette: a bright, light-blue look carried over from the
 * original canvas demo, over a deep-slate page backdrop.
 *
 * @deprecated colours now come from themeColors() in ./themes; this constant
 * only remains as the compile-time shape reference.
 */
export type { ThemeColors } from './themes';

/** Phaser text styles need a css colour string. */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function computeDesignHeight(viewportWidth: number, viewportHeight: number): number {
  const aspect = viewportHeight / Math.max(1, viewportWidth);
  const h = Math.round(DESIGN_WIDTH * aspect);
  return Math.max(MIN_DESIGN_HEIGHT, Math.min(MAX_DESIGN_HEIGHT, h));
}

export function devicePixelRatioCapped(): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.max(1, Math.min(MAX_DPR, dpr));
}
