import { describe, expect, it } from 'vitest';
import {
  activeThemeId,
  isThemeId,
  playerSpriteKey,
  resolvePlayerSprite,
  setActiveTheme,
  THEME_IDS,
  themeColors,
  THEMES,
  type ThemeColors,
} from '../src/game/config/themes';

const REQUIRED_KEYS: (keyof ThemeColors)[] = [
  'bgTop',
  'bgBottom',
  'decor',
  'textPrimary',
  'textSecondary',
  'button',
  'buttonText',
  'buttonSecondary',
  'panel',
  'panelText',
  'overlay',
  'accent',
  'danger',
  'tile',
  'tileStroke',
  'heart',
];

const EXPECTED_PRICES: Record<string, number> = {
  sky: 0,
  space: 200,
  forest: 150,
  sunset: 150,
  ocean: 250,
  neon: 300,
  snow: 250,
  lava: 400,
};

describe('themes', () => {
  it('ships exactly eight themes with unique ids, complete palettes and sprites', () => {
    expect(THEME_IDS).toEqual(['sky', 'space', 'forest', 'sunset', 'ocean', 'neon', 'snow', 'lava']);
    expect(new Set(THEME_IDS).size).toBe(8);
    for (const id of THEME_IDS) {
      const theme = THEMES[id];
      expect(theme.id).toBe(id);
      expect(theme.sprite).toBe(`player-${id}`);
      expect(theme.name.length).toBeGreaterThan(0);
      for (const key of REQUIRED_KEYS) {
        expect(typeof theme.colors[key], `${id}.${key}`).toBe('number');
      }
    }
  });

  it('follows the price table; sky stays free', () => {
    for (const id of THEME_IDS) {
      expect(THEMES[id].price, id).toBe(EXPECTED_PRICES[id]);
    }
  });

  it('keeps the legacy ids stable so existing unlocks stay valid', () => {
    for (const id of ['sky', 'forest', 'sunset', 'neon']) {
      expect(isThemeId(id)).toBe(true);
    }
  });

  it('sky keeps the original palette (regression guard)', () => {
    expect(THEMES.sky.colors.bgTop).toBe(0xe8f4fd);
    expect(THEMES.sky.colors.tile).toBe(0x87ceeb);
    expect(THEMES.sky.colors.accent).toBe(0x2f9be8);
  });

  it('setActiveTheme switches the palette and rejects unknown ids', () => {
    setActiveTheme('forest');
    expect(activeThemeId()).toBe('forest');
    expect(themeColors().tile).toBe(THEMES.forest.colors.tile);
    setActiveTheme('nope');
    expect(activeThemeId()).toBe('sky');
    setActiveTheme('lava');
    expect(themeColors().tile).toBe(0xff7040);
    setActiveTheme('sky');
  });

  it('playerSpriteKey maps ids to texture keys', () => {
    expect(playerSpriteKey('sky')).toBe('player-sky');
    expect(playerSpriteKey('lava')).toBe('player-lava');
  });
});

describe('resolvePlayerSprite fallback chain', () => {
  const available =
    (...keys: string[]) =>
    (key: string) =>
      keys.includes(key);

  it('prefers the active theme sprite', () => {
    expect(resolvePlayerSprite('neon', available('player-neon', 'player-sky'))).toBe('player-neon');
  });

  it('falls back to the procedural block (null) when the theme sprite is missing', () => {
    // The base edition (sky) owns the yellow block, so a missing themed
    // sprite must NOT substitute the sky sprite — it degrades procedurally.
    expect(resolvePlayerSprite('lava', available('player-sky'))).toBeNull();
  });

  it('the base edition (sky) uses the naive AI yellow block when it loads', () => {
    expect(resolvePlayerSprite('sky', available('player-sky'))).toBe('player-sky');
  });

  it('the base edition (sky) falls back to the procedural yellow block when its sprite is missing', () => {
    expect(resolvePlayerSprite('sky', available())).toBeNull();
  });

  it('returns null (procedural fallback) when every sprite is missing', () => {
    expect(resolvePlayerSprite('ocean', available())).toBeNull();
  });

  it('an unknown theme id resolves its own sprite when present', () => {
    expect(resolvePlayerSprite('whatever', available('player-whatever'))).toBe('player-whatever');
    expect(resolvePlayerSprite('whatever', available('player-sky'))).toBeNull();
  });
});
