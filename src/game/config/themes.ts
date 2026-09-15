/**
 * Theme system: four palettes (sky/forest/sunset/neon). Scenes read colours
 * once at create() time via themeColors(); ThemeScene switches the active
 * theme with setActiveTheme() and then simply restarts itself.
 *
 * The palette mirrors the old static COLORS table plus `heart`, so every
 * surface (tiles, HUD band, background, hearts, buttons) follows the theme.
 */

export interface ThemeColors {
  bgTop: number;
  bgBottom: number;
  decor: number;
  textPrimary: number;
  textSecondary: number;
  button: number;
  buttonText: number;
  buttonSecondary: number;
  panel: number;
  panelText: number;
  overlay: number;
  accent: number;
  danger: number;
  tile: number;
  tileStroke: number;
  heart: number;
}

export interface ThemeDef {
  id: string;
  name: string;
  /** Coin price; 0 = unlocked by default. */
  price: number;
  colors: ThemeColors;
}

export const THEME_IDS = ['sky', 'forest', 'sunset', 'neon'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const THEMES: Record<ThemeId, ThemeDef> = {
  sky: {
    id: 'sky',
    name: '天空',
    price: 0,
    colors: {
      bgTop: 0xe8f4fd,
      bgBottom: 0xc4e2f8,
      decor: 0x7ec3ee,
      textPrimary: 0x17364f,
      textSecondary: 0x51708c,
      button: 0x2f9be8,
      buttonText: 0xffffff,
      buttonSecondary: 0xffffff,
      panel: 0xffffff,
      panelText: 0x17364f,
      overlay: 0x0b1d33,
      accent: 0x2f9be8,
      danger: 0xe05252,
      tile: 0x87ceeb,
      tileStroke: 0x4682b4,
      heart: 0xff5577,
    },
  },
  forest: {
    id: 'forest',
    name: '森林',
    price: 150,
    colors: {
      bgTop: 0xeafbef,
      bgBottom: 0xc6ebcf,
      decor: 0x7fd08e,
      textPrimary: 0x1d4630,
      textSecondary: 0x4a7561,
      button: 0x2fa05c,
      buttonText: 0xffffff,
      buttonSecondary: 0xffffff,
      panel: 0xffffff,
      panelText: 0x1d4630,
      overlay: 0x0d2818,
      accent: 0x2fa05c,
      danger: 0xe05252,
      tile: 0x8fd694,
      tileStroke: 0x3f8f5a,
      heart: 0xff5577,
    },
  },
  sunset: {
    id: 'sunset',
    name: '落日',
    price: 150,
    colors: {
      bgTop: 0xfff1e3,
      bgBottom: 0xffd2bd,
      decor: 0xf7a072,
      textPrimary: 0x5c2e1f,
      textSecondary: 0x96604c,
      button: 0xf2711c,
      buttonText: 0xffffff,
      buttonSecondary: 0xfffaf5,
      panel: 0xfffaf5,
      panelText: 0x5c2e1f,
      overlay: 0x2e1408,
      accent: 0xf2711c,
      danger: 0xd64545,
      tile: 0xffa25e,
      tileStroke: 0xd96c2c,
      heart: 0xff5e78,
    },
  },
  neon: {
    id: 'neon',
    name: '霓虹',
    price: 300,
    colors: {
      bgTop: 0x191631,
      bgBottom: 0x2a1e5c,
      decor: 0x6a4fd8,
      textPrimary: 0xf2f0ff,
      textSecondary: 0xa89fd6,
      button: 0x00d5f5,
      buttonText: 0x062a33,
      buttonSecondary: 0xf5f3ff,
      panel: 0xf5f3ff,
      panelText: 0x241f42,
      overlay: 0x05030f,
      accent: 0x00d5f5,
      danger: 0xff4d6d,
      tile: 0x8f5bff,
      tileStroke: 0x3fd8f5,
      heart: 0xff4d88,
    },
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'sky';

let active: ThemeId = DEFAULT_THEME_ID;

export function isThemeId(id: string): id is ThemeId {
  return (THEME_IDS as readonly string[]).includes(id);
}

/** Point the palette at a theme; unknown ids fall back to sky. */
export function setActiveTheme(id: string): void {
  active = isThemeId(id) ? id : DEFAULT_THEME_ID;
}

export function activeThemeId(): ThemeId {
  return active;
}

/** Colours of the active theme. Read once per scene create(). */
export function themeColors(): ThemeColors {
  return THEMES[active].colors;
}
