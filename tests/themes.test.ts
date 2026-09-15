import { describe, expect, it } from 'vitest';
import { activeThemeId, isThemeId, setActiveTheme, THEME_IDS, themeColors, THEMES, type ThemeColors } from '../src/game/config/themes';

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

describe('themes', () => {
  it('ships exactly sky/forest/sunset/neon with complete palettes', () => {
    expect(THEME_IDS).toEqual(['sky', 'forest', 'sunset', 'neon']);
    for (const id of THEME_IDS) {
      for (const key of REQUIRED_KEYS) {
        expect(typeof THEMES[id].colors[key], `${id}.${key}`).toBe('number');
      }
    }
  });

  it('sky is free; forest/sunset cost 150; neon costs 300', () => {
    expect(THEMES.sky.price).toBe(0);
    expect(THEMES.forest.price).toBe(150);
    expect(THEMES.sunset.price).toBe(150);
    expect(THEMES.neon.price).toBe(300);
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
    setActiveTheme('neon');
    expect(themeColors().textPrimary).toBe(0xf2f0ff);
    setActiveTheme('sky');
  });

  it('isThemeId narrows strings', () => {
    expect(isThemeId('sunset')).toBe(true);
    expect(isThemeId('ocean')).toBe(false);
  });
});
