/**
 * The 13 shaped-row patterns. Each produces a boolean mask of length
 * `tilesPerRow`; `true` means a tile spawns in that column. Randomness is
 * injected so tests can seed it.
 */
import type { PatternType } from './types';

export const PATTERN_TYPES: readonly PatternType[] = [
  'corridor',
  'walls',
  'center',
  'sides',
  'gaps',
  'zigzag',
  'diamond',
  'wave',
  'tunnel',
  'stairs',
  'cross',
  'random',
  'barrier',
];

export function pickPattern(rng: () => number = Math.random): PatternType {
  const idx = Math.floor(rng() * PATTERN_TYPES.length);
  return PATTERN_TYPES[Math.min(idx, PATTERN_TYPES.length - 1)] ?? 'random';
}

export function generatePattern(patternType: PatternType, tilesPerRow: number, rng: () => number = Math.random): boolean[] {
  const pattern = new Array<boolean>(tilesPerRow).fill(false);
  const center = Math.floor(tilesPerRow / 2);

  switch (patternType) {
    case 'corridor':
      // Open corridor down the middle.
      for (let i = 0; i < tilesPerRow; i++) {
        if (i < center - 3 || i > center + 3) pattern[i] = true;
      }
      break;
    case 'walls':
      for (let i = 0; i < 2; i++) {
        pattern[i] = true;
        pattern[tilesPerRow - 1 - i] = true;
      }
      break;
    case 'center':
      for (let i = center - 2; i <= center + 2; i++) {
        if (i >= 0 && i < tilesPerRow) pattern[i] = true;
      }
      break;
    case 'sides':
      for (let i = 0; i < tilesPerRow; i++) {
        if (i < tilesPerRow * 0.25 || i > tilesPerRow * 0.75) pattern[i] = true;
      }
      break;
    case 'gaps':
    case 'zigzag':
      // Two tiles, two gaps, repeating. (The original maps both names here.)
      for (let i = 0; i < tilesPerRow; i++) {
        if (i % 4 === 0 || i % 4 === 1) pattern[i] = true;
      }
      break;
    case 'diamond': {
      const diamondSize = Math.min(4, Math.floor(tilesPerRow / 3));
      for (let i = center - diamondSize; i <= center + diamondSize; i++) {
        if (i >= 0 && i < tilesPerRow) pattern[i] = true;
      }
      break;
    }
    case 'wave':
      for (let i = 0; i < tilesPerRow; i++) {
        if (Math.sin(i * 0.8) > 0) pattern[i] = true;
      }
      break;
    case 'tunnel':
      // Tiles on both flanks, sparse debris in the passage.
      for (let i = 0; i < tilesPerRow; i++) {
        if (i < 2 || i > tilesPerRow - 3) pattern[i] = true;
        else if (rng() < 0.3) pattern[i] = true;
      }
      break;
    case 'stairs':
      for (let i = 0; i < tilesPerRow; i++) {
        if (i % 2 === 0 && i < tilesPerRow * 0.8) pattern[i] = true;
      }
      break;
    case 'cross':
      for (let i = 0; i < tilesPerRow; i++) {
        if (i === center || i === center - 1 || i === center + 1) pattern[i] = true;
      }
      break;
    case 'random':
      for (let i = 0; i < tilesPerRow; i++) {
        if (rng() < 0.5) pattern[i] = true;
      }
      break;
    case 'barrier': {
      const positions = [
        Math.floor(tilesPerRow * 0.2),
        Math.floor(tilesPerRow * 0.5),
        Math.floor(tilesPerRow * 0.8),
      ];
      for (const pos of positions) {
        for (let i = pos - 1; i <= pos + 1; i++) {
          if (i >= 0 && i < tilesPerRow) pattern[i] = true;
        }
      }
      break;
    }
  }
  return pattern;
}
