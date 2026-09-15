import { describe, expect, it } from 'vitest';
import { ASSET_TEX_FAILED_KEY, isOptionalArtKey, optionalArtManifest } from '../src/game/config/assets';
import { resolveThemeBg, resolveThemeTile, themeBgKey, themeTileKey, THEME_IDS } from '../src/game/config/themes';

describe('optional art manifest', () => {
  it('lists 8 sprites + 8 tiles + 8 backgrounds with matching urls', () => {
    const files = optionalArtManifest();
    expect(files).toHaveLength(24);
    for (const id of THEME_IDS) {
      expect(files).toContainEqual({ key: `player-${id}`, url: `assets/player-${id}.png` });
      expect(files).toContainEqual({ key: `tile-${id}`, url: `assets/tile-${id}.png` });
      expect(files).toContainEqual({ key: `bg-${id}`, url: `assets/bg-${id}.jpg` });
    }
  });

  it('isOptionalArtKey covers the three families only', () => {
    expect(isOptionalArtKey('player-sky')).toBe(true);
    expect(isOptionalArtKey('tile-lava')).toBe(true);
    expect(isOptionalArtKey('bg-neon')).toBe(true);
    expect(isOptionalArtKey('hb-player')).toBe(false);
    expect(isOptionalArtKey('manifest')).toBe(false);
  });

  it('registry key is stable', () => {
    expect(ASSET_TEX_FAILED_KEY).toBe('assetTexFailed');
  });
});

describe('theme tile/bg fallback', () => {
  const available =
    (...keys: string[]) =>
    (key: string) =>
      keys.includes(key);

  it('keys follow the naming convention', () => {
    expect(themeTileKey('sky')).toBe('tile-sky');
    expect(themeBgKey('lava')).toBe('bg-lava');
  });

  it('resolves art when present, null when missing (no cross-theme fallback)', () => {
    expect(resolveThemeTile('lava', available('tile-lava'))).toBe('tile-lava');
    expect(resolveThemeTile('lava', available('tile-sky'))).toBeNull();
    expect(resolveThemeBg('ocean', available('bg-ocean'))).toBe('bg-ocean');
    expect(resolveThemeBg('ocean', available())).toBeNull();
  });
});
