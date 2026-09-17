import { describe, expect, it } from 'vitest';
import {
  BOMB_PARAMS,
  ITEM_META,
  ITEM_UNLOCK_TIERS,
  PERK_MAX_BULLET_COLUMNS,
} from '../src/core/config';
import { availableItems, dropChance, weaponBaseCooldown, weaponCooldown, weaponDuration } from '../src/core/config';
import type { BombType } from '../src/core/types';

describe('item unlock table', () => {
  it('tier levels are strictly increasing', () => {
    for (let i = 1; i < ITEM_UNLOCK_TIERS.length; i++) {
      const prev = ITEM_UNLOCK_TIERS[i - 1];
      const cur = ITEM_UNLOCK_TIERS[i];
      expect(cur && prev && cur.level > prev.level).toBe(true);
    }
  });

  it('the pool grows monotonically with level', () => {
    let previous = availableItems(1);
    for (let level = 2; level <= 25; level++) {
      const current = availableItems(level);
      for (const item of previous) expect(current).toContain(item);
      previous = current;
    }
  });

  it('level 1 pool is exactly uzi/bomb/shield', () => {
    expect(availableItems(1).sort()).toEqual(['bomb', 'shield', 'uzi']);
    expect(availableItems(2)).toHaveLength(3);
  });

  it('higher tiers unlock at the documented levels', () => {
    expect(availableItems(3)).toContain('shotgun');
    expect(availableItems(3)).toContain('boomerang');
    expect(availableItems(5)).toContain('laser');
    expect(availableItems(5)).toContain('bigbomb');
    expect(availableItems(7)).toContain('spread');
    expect(availableItems(7)).toContain('diagonalbomb');
    expect(availableItems(9)).toContain('linebomb');
    expect(availableItems(9)).toContain('speedboost');
    expect(availableItems(11)).toContain('doublebullets');
    expect(availableItems(11)).toContain('rapidfire');
    expect(availableItems(13)).toContain('piercing');
    expect(availableItems(13)).toContain('magnet');
    expect(availableItems(15)).toContain('shieldbooster');
    expect(availableItems(15)).toContain('weaponduration');
    expect(availableItems(15)).toContain('extralife');
    expect(availableItems(14)).not.toContain('extralife');
  });

  it('bigbullets drops out once bullet columns are maxed', () => {
    expect(availableItems(13, 1)).toContain('bigbullets');
    expect(availableItems(13, PERK_MAX_BULLET_COLUMNS)).not.toContain('bigbullets');
  });

  it('every item has display metadata', () => {
    for (const tier of ITEM_UNLOCK_TIERS) {
      for (const item of tier.items) {
        expect(ITEM_META[item].name).toBeTruthy();
      }
    }
  });
});

describe('dropChance', () => {
  it('is 0.055 + level * 0.015, capped at 0.22', () => {
    expect(dropChance(1)).toBeCloseTo(0.07);
    expect(dropChance(8)).toBeCloseTo(0.175);
    expect(dropChance(11)).toBeCloseTo(0.22);
    expect(dropChance(50)).toBe(0.22);
  });
});

describe('weapon cooldowns', () => {
  it('default is 30 frames', () => {
    expect(weaponBaseCooldown('default', 1)).toBe(30);
  });

  it('uzi floors at 3 frames', () => {
    expect(weaponBaseCooldown('uzi', 1)).toBe(7);
    expect(weaponBaseCooldown('uzi', 5)).toBe(3);
    expect(weaponBaseCooldown('uzi', 99)).toBe(3);
  });

  it('shotgun floors at 25, laser at 35, spread at 12', () => {
    expect(weaponBaseCooldown('shotgun', 1)).toBe(38);
    expect(weaponBaseCooldown('shotgun', 99)).toBe(25);
    expect(weaponBaseCooldown('laser', 1)).toBe(47);
    expect(weaponBaseCooldown('laser', 99)).toBe(35);
    expect(weaponBaseCooldown('spread', 1)).toBe(23);
    expect(weaponBaseCooldown('spread', 99)).toBe(12);
  });

  it('rapid fire halves the cooldown (floored)', () => {
    expect(weaponCooldown('default', 1, false)).toBe(30);
    expect(weaponCooldown('default', 1, true)).toBe(15);
    expect(weaponCooldown('uzi', 5, true)).toBe(1);
  });
});

describe('weaponDuration', () => {
  it('is 600 + level*60 + weapon bonus, scaled by the duration boost', () => {
    expect(weaponDuration('uzi', 1, 1)).toBe(660);
    expect(weaponDuration('shotgun', 1, 1)).toBe(720);
    expect(weaponDuration('laser', 1, 1)).toBe(780);
    expect(weaponDuration('spread', 1, 1)).toBe(750);
    expect(weaponDuration('uzi', 5, 1)).toBe(900);
    expect(weaponDuration('uzi', 1, 1.5)).toBe(Math.floor(660 * 1.5));
  });
});

describe('bomb params', () => {
  it('match the original five bomb types', () => {
    expect(BOMB_PARAMS.normal).toMatchObject({ speed: 6, explosionRadius: 80, baseDamage: 4 });
    expect(BOMB_PARAMS.big).toMatchObject({ speed: 5, explosionRadius: 120, baseDamage: 8 });
    expect(BOMB_PARAMS.diagonal).toMatchObject({ speed: 7, explosionRadius: 70, baseDamage: 4 });
    expect(BOMB_PARAMS.horizontal).toMatchObject({ speed: 6, explosionRadius: 60, baseDamage: 4 });
    expect(BOMB_PARAMS.line).toMatchObject({ speed: 8, explosionRadius: 40, baseDamage: 6, isLine: true });
  });

  it('all five bomb types are present', () => {
    const types: BombType[] = ['normal', 'big', 'diagonal', 'horizontal', 'line'];
    for (const t of types) expect(BOMB_PARAMS[t]).toBeDefined();
  });
});
