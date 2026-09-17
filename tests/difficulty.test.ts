import { describe, expect, it } from 'vitest';
import { calculatePlayerPower, calculateTileDensity, calculateTileHealthRange, difficultyLabel, tileFallSpeed } from '../src/core/difficulty';
import type { PowerInput, WeaponState, WeaponType } from '../src/core/types';

function weapon(active: boolean, level = 1): WeaponState {
  return { active, level, duration: 0, maxDuration: 0, cooldown: 0 };
}

function powerInput(overrides: Partial<Record<WeaponType, WeaponState>> = {}, extra: Partial<Omit<PowerInput, 'weapons'>> = {}): PowerInput {
  return {
    weapons: {
      default: weapon(true),
      uzi: weapon(false),
      shotgun: weapon(false),
      laser: weapon(false),
      spread: weapon(false),
      ...overrides,
    },
    doubleBullets: false,
    rapidFire: false,
    piercingBullets: false,
    bulletColumns: 1,
    speedBoost: 0,
    ...extra,
  };
}

describe('calculatePlayerPower', () => {
  it('starts at 1 with only the default weapon', () => {
    expect(calculatePlayerPower(powerInput())).toBe(1);
  });

  it('adds weapon level coefficients', () => {
    expect(calculatePlayerPower(powerInput({ uzi: weapon(true, 3) }))).toBeCloseTo(1 + 3 * 1.2);
    expect(calculatePlayerPower(powerInput({ laser: weapon(true, 5) }))).toBeCloseTo(1 + 5 * 1.8);
    expect(calculatePlayerPower(powerInput({ shotgun: weapon(true, 2) }))).toBeCloseTo(1 + 2 * 1.5);
    expect(calculatePlayerPower(powerInput({ spread: weapon(true, 4) }))).toBeCloseTo(1 + 4 * 1.3);
  });

  it('ignores inactive weapons', () => {
    expect(calculatePlayerPower(powerInput({ uzi: weapon(false, 5) }))).toBe(1);
  });

  it('adds permanent boost power', () => {
    expect(calculatePlayerPower(powerInput({}, { doubleBullets: true }))).toBeCloseTo(3);
    expect(calculatePlayerPower(powerInput({}, { rapidFire: true }))).toBeCloseTo(2.5);
    expect(calculatePlayerPower(powerInput({}, { piercingBullets: true }))).toBeCloseTo(2.3);
    expect(calculatePlayerPower(powerInput({}, { bulletColumns: 2 }))).toBeCloseTo(1 + 1.5);
    expect(calculatePlayerPower(powerInput({}, { speedBoost: 6 }))).toBeCloseTo(1 + 1.2);
  });

  it('adds multi-weapon synergy (+0.5 per extra weapon beyond one)', () => {
    const two = powerInput({ uzi: weapon(true, 1), shotgun: weapon(true, 1) });
    // 1 + 1.2 + 1.5 + 2*0.5
    expect(calculatePlayerPower(two)).toBeCloseTo(4.7);
  });

  it('never drops below 1', () => {
    expect(calculatePlayerPower(powerInput())).toBeGreaterThanOrEqual(1);
  });
});

describe('calculateTileDensity', () => {
  it('is 0.62 + min(power/12, 0.22) + min(level/24, 0.16), capped at 0.9', () => {
    expect(calculateTileDensity(1, 1)).toBeCloseTo(0.62 + 1 / 12 + 1 / 24);
    expect(calculateTileDensity(50, 50)).toBe(0.9);
  });

  it('caps the power and level contributions at 0.22 / 0.16', () => {
    expect(calculateTileDensity(100, 0)).toBeCloseTo(0.84);
    expect(calculateTileDensity(0, 100)).toBeCloseTo(0.78);
  });
});

describe('calculateTileHealthRange', () => {
  it('level 1, power 1 -> { min: 1, max: 2 }', () => {
    expect(calculateTileHealthRange(1, 1)).toEqual({ min: 1, max: 2 });
  });

  it('grows with level', () => {
    const r = calculateTileHealthRange(1, 10);
    // baseMin = floor(10/3) = 3, baseMax = 12, multiplier max(0.8, 0.125) = 0.8
    expect(r.min).toBe(Math.max(1, Math.floor(3 * 0.8)));
    expect(r.max).toBe(Math.floor(12 * 0.8));
  });

  it('caps max at 40 up to level 30, even for absurd power, keeping min <= max', () => {
    const r = calculateTileHealthRange(200, 30);
    expect(r.max).toBe(40);
    expect(r.min).toBeLessThanOrEqual(r.max);
    expect(r.min).toBeGreaterThanOrEqual(1);
  });

  it('keeps the 40 cap at exactly level 30', () => {
    expect(calculateTileHealthRange(1, 30).max).toBeLessThanOrEqual(40);
  });

  it('raises the cap by 2 per level past 30 (endgame pressure)', () => {
    // L40: cap = 40 + 10*2 = 60; power high enough that the raw max exceeds it.
    const r = calculateTileHealthRange(200, 40);
    expect(r.max).toBe(60);
    expect(r.min).toBeLessThanOrEqual(r.max);
    // L50: cap = 80.
    expect(calculateTileHealthRange(200, 50).max).toBe(80);
  });

  it('min is always at least 1', () => {
    expect(calculateTileHealthRange(1, 1).min).toBeGreaterThanOrEqual(1);
    expect(calculateTileHealthRange(0.5, 2).min).toBeGreaterThanOrEqual(1);
  });
});

describe('tileFallSpeed', () => {
  it('is gameSpeed * 0.42 at power 1', () => {
    expect(tileFallSpeed(1, 1)).toBeCloseTo(0.42);
  });

  it('caps the power multiplier at 1.4', () => {
    expect(tileFallSpeed(2, 1000)).toBeCloseTo(2 * 0.42 * 1.4);
  });

  it('applies no level pressure at or below level 30', () => {
    expect(tileFallSpeed(1, 1, 30)).toBeCloseTo(tileFallSpeed(1, 1));
    expect(tileFallSpeed(1, 1, 12)).toBeCloseTo(tileFallSpeed(1, 1));
  });

  it('adds 3% speed per level past 30 (L40 -> x1.3)', () => {
    expect(tileFallSpeed(1, 1, 40)).toBeCloseTo(0.42 * 1.3);
    expect(tileFallSpeed(2, 1000, 40)).toBeCloseTo(2 * 0.42 * 1.4 * 1.3);
  });
});

describe('difficultyLabel', () => {
  it('maps power to labels', () => {
    expect(difficultyLabel(1)).toBe('简单');
    expect(difficultyLabel(4.9)).toBe('简单');
    expect(difficultyLabel(5)).toBe('稍难');
    expect(difficultyLabel(8)).toBe('中等');
    expect(difficultyLabel(12)).toBe('困难');
    expect(difficultyLabel(15)).toBe('地狱');
  });
});
