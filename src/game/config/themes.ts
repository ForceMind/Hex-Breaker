/**
 * Skin theme system: eight character-skin + background bundles. Each theme
 * pairs a palette with a player sprite (`assets/player-<id>.png`, loaded in
 * BootScene; missing art degrades gracefully). Scenes read colours once at
 * create() time via themeColors(); ThemeScene switches the active theme with
 * setActiveTheme() and then simply restarts itself.
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
  /** Player sprite texture key, e.g. player-sky. */
  sprite: string;
}

export const THEME_IDS = ['sky', 'space', 'forest', 'sunset', 'ocean', 'neon', 'snow', 'lava'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export function playerSpriteKey(id: string): string {
  return `player-${id}`;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  sky: {
    id: 'sky',
    name: '天空',
    price: 0,
    sprite: playerSpriteKey('sky'),
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
  space: {
    id: 'space',
    name: '宇宙',
    price: 200,
    sprite: playerSpriteKey('space'),
    colors: {
      bgTop: 0x101c3a,
      bgBottom: 0x1d2f63,
      decor: 0x3a5ccc,
      textPrimary: 0xeaf2ff,
      textSecondary: 0x93a8d8,
      button: 0x4d8dff,
      buttonText: 0xffffff,
      buttonSecondary: 0xf2f6ff,
      panel: 0xf2f6ff,
      panelText: 0x14224a,
      overlay: 0x060b1c,
      accent: 0x4d8dff,
      danger: 0xff5a66,
      tile: 0x9ecfff,
      tileStroke: 0x4d8dff,
      heart: 0xff5a7a,
    },
  },
  forest: {
    id: 'forest',
    name: '森林',
    price: 150,
    sprite: playerSpriteKey('forest'),
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
    sprite: playerSpriteKey('sunset'),
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
  ocean: {
    id: 'ocean',
    name: '海洋',
    price: 250,
    sprite: playerSpriteKey('ocean'),
    colors: {
      bgTop: 0xe3f7fa,
      bgBottom: 0xbde9f2,
      decor: 0x6ccbd8,
      textPrimary: 0x0f3d4d,
      textSecondary: 0x3f7080,
      button: 0x17a2b8,
      buttonText: 0xffffff,
      buttonSecondary: 0xffffff,
      panel: 0xffffff,
      panelText: 0x0f3d4d,
      overlay: 0x06222e,
      accent: 0x17a2b8,
      danger: 0xe05252,
      tile: 0x5fd0df,
      tileStroke: 0x17889e,
      heart: 0xff5577,
    },
  },
  neon: {
    id: 'neon',
    name: '霓虹',
    price: 300,
    sprite: playerSpriteKey('neon'),
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
  snow: {
    id: 'snow',
    name: '雪地',
    price: 250,
    sprite: playerSpriteKey('snow'),
    colors: {
      bgTop: 0xffffff,
      bgBottom: 0xdff0fb,
      decor: 0xa9cdea,
      textPrimary: 0x2a4258,
      textSecondary: 0x64809a,
      button: 0x5aa2e0,
      buttonText: 0xffffff,
      buttonSecondary: 0xffffff,
      panel: 0xffffff,
      panelText: 0x2a4258,
      overlay: 0x12202e,
      accent: 0x5aa2e0,
      danger: 0xe05252,
      tile: 0xcfe8f8,
      tileStroke: 0x7fb2dc,
      heart: 0xff5577,
    },
  },
  lava: {
    id: 'lava',
    name: '熔岩',
    price: 400,
    sprite: playerSpriteKey('lava'),
    colors: {
      bgTop: 0x1c0e0a,
      bgBottom: 0x3a1510,
      decor: 0xb03a1e,
      textPrimary: 0xffe9dd,
      textSecondary: 0xd89a82,
      button: 0xe8541c,
      buttonText: 0xffffff,
      buttonSecondary: 0xfff1ea,
      panel: 0xfff1ea,
      panelText: 0x3a1510,
      overlay: 0x0a0402,
      accent: 0xff6a2b,
      danger: 0xff3d3d,
      tile: 0xff7040,
      tileStroke: 0xa82e0e,
      heart: 0xff5e5e,
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

/**
 * Player sprite fallback chain: the theme's own sprite -> null (caller falls
 * back to the procedural block). `available` reports whether a texture key
 * is loaded and intact.
 *
 * Art principle: the default theme (sky) IS the v1 base edition and keeps
 * the plain naive yellow block look — now drawn by an AI "naive yellow
 * block" sprite (`player-sky`) when it loads, with the procedural block as
 * the fallback. Themed AI sprites are the paid skins and never fall back to
 * the sky sprite.
 */
export function resolvePlayerSprite(themeId: string, available: (key: string) => boolean): string | null {
  const primary = playerSpriteKey(themeId);
  if (available(primary)) return primary;
  return null;
}

export function themeTileKey(id: string): string {
  return `tile-${id}`;
}

export function themeBgKey(id: string): string {
  return `bg-${id}`;
}

/** Tile face art for the theme, or null -> full procedural tile rendering. */
export function resolveThemeTile(themeId: string, available: (key: string) => boolean): string | null {
  const key = themeTileKey(themeId);
  return available(key) ? key : null;
}

/** Background art for the theme, or null -> the procedural gradient. */
export function resolveThemeBg(themeId: string, available: (key: string) => boolean): string | null {
  const key = themeBgKey(themeId);
  return available(key) ? key : null;
}
