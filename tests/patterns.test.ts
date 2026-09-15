import { describe, expect, it } from 'vitest';
import { FULL_ROW_NAME, PATTERN_NAMES } from '../src/core/config';
import { generatePattern, PATTERN_TYPES, pickPattern } from '../src/core/patterns';
import { mulberry32 } from '../src/core/prng';

const COLS = 9; // floor(540 / 55), the design-resolution row width

describe('patterns', () => {
  it('covers exactly the 13 original pattern types', () => {
    expect(PATTERN_TYPES).toHaveLength(13);
    expect(new Set(PATTERN_TYPES).size).toBe(13);
  });

  it('every pattern has a Chinese display name', () => {
    for (const p of PATTERN_TYPES) {
      expect(PATTERN_NAMES[p]).toBeTruthy();
    }
    expect(FULL_ROW_NAME).toBe('传统');
  });

  it('masks have the requested length and contain only booleans', () => {
    for (const p of PATTERN_TYPES) {
      const mask = generatePattern(p, COLS, mulberry32(42));
      expect(mask).toHaveLength(COLS);
      for (const cell of mask) expect(typeof cell).toBe('boolean');
    }
  });

  it('every pattern places at least one tile at 9 columns', () => {
    for (const p of PATTERN_TYPES) {
      const mask = generatePattern(p, COLS, mulberry32(7));
      expect(mask.some(Boolean)).toBe(true);
    }
  });

  it('walls: two columns on each side', () => {
    expect(generatePattern('walls', COLS)).toEqual([true, true, false, false, false, false, false, true, true]);
  });

  it('center: five central columns', () => {
    expect(generatePattern('center', COLS)).toEqual([false, false, true, true, true, true, true, false, false]);
  });

  it('corridor: leaves the middle open', () => {
    const mask = generatePattern('corridor', COLS);
    expect(mask[4]).toBe(false);
    expect(mask[0]).toBe(true);
    expect(mask[COLS - 1]).toBe(true);
  });

  it('gaps and zigzag: two-on two-off', () => {
    const expected = [true, true, false, false, true, true, false, false, true];
    expect(generatePattern('gaps', COLS)).toEqual(expected);
    expect(generatePattern('zigzag', COLS)).toEqual(expected);
  });

  it('cross: only the centre three columns', () => {
    expect(generatePattern('cross', COLS)).toEqual([false, false, false, true, true, true, false, false, false]);
  });

  it('tunnel always walls off both flanks', () => {
    for (let seed = 0; seed < 20; seed++) {
      const mask = generatePattern('tunnel', COLS, mulberry32(seed));
      expect(mask[0]).toBe(true);
      expect(mask[1]).toBe(true);
      expect(mask[COLS - 1]).toBe(true);
      expect(mask[COLS - 2]).toBe(true);
    }
  });

  it('random and tunnel are deterministic under a seeded rng', () => {
    expect(generatePattern('random', COLS, mulberry32(1))).toEqual(generatePattern('random', COLS, mulberry32(1)));
    expect(generatePattern('tunnel', COLS, mulberry32(2))).toEqual(generatePattern('tunnel', COLS, mulberry32(2)));
  });

  it('pickPattern always returns a known pattern', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 200; i++) {
      expect(PATTERN_TYPES).toContain(pickPattern(rng));
    }
  });
});

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
