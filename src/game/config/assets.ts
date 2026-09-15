/**
 * Optional AI art manifest: player sprites, tile faces and background images,
 * all named assets/<kind>-<themeId>.<ext>. Everything here is optional — the
 * loader records failures per key and every consumer has a full fallback.
 */
import { playerSpriteKey, themeBgKey, themeTileKey, THEME_IDS } from './themes';

/** Registry key holding the list of optional-art keys that failed to load. */
export const ASSET_TEX_FAILED_KEY = 'assetTexFailed';

export interface ArtFile {
  key: string;
  url: string;
}

export function optionalArtManifest(): ArtFile[] {
  const files: ArtFile[] = [];
  for (const id of THEME_IDS) {
    files.push({ key: playerSpriteKey(id), url: `assets/player-${id}.png` });
    files.push({ key: themeTileKey(id), url: `assets/tile-${id}.png` });
    files.push({ key: themeBgKey(id), url: `assets/bg-${id}.jpg` });
  }
  return files;
}

/** Whether a loader file key belongs to the optional art set. */
export function isOptionalArtKey(key: string): boolean {
  return /^(player|tile|bg)-/.test(key);
}
