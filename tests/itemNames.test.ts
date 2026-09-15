import { describe, expect, it } from 'vitest';
import { ITEM_META } from '../src/core/config';
import { ITEM_NAMES, itemName } from '../src/core/itemNames';
import { THEME_IDS } from '../src/game/config/themes';
import type { ItemType } from '../src/core/types';

const ALL_ITEMS = Object.keys(ITEM_META) as ItemType[];

describe('ITEM_NAMES table', () => {
  it('covers all 8 themes x 20 items with non-empty strings', () => {
    expect(Object.keys(ITEM_NAMES).sort()).toEqual([...THEME_IDS].sort());
    for (const id of THEME_IDS) {
      const table = ITEM_NAMES[id];
      expect(table, id).toBeTruthy();
      for (const type of ALL_ITEMS) {
        expect(typeof table?.[type], `${id}.${type}`).toBe('string');
        expect(table?.[type].length, `${id}.${type}`).toBeGreaterThan(0);
      }
    }
  });

  it('sky column matches the default ITEM_META names exactly', () => {
    for (const type of ALL_ITEMS) {
      expect(ITEM_NAMES.sky?.[type], type).toBe(ITEM_META[type].name);
    }
  });

  it('non-sky themes actually re-skin (at least most names differ from sky)', () => {
    for (const id of THEME_IDS) {
      if (id === 'sky') continue;
      const different = ALL_ITEMS.filter((type) => ITEM_NAMES[id]?.[type] !== ITEM_META[type].name).length;
      expect(different, id).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('itemName', () => {
  it('returns the themed name', () => {
    expect(itemName('lava', 'uzi')).toBe('熔岩机炮');
    expect(itemName('ocean', 'extralife')).toBe('救生圈');
    expect(itemName('snow', 'boomerang')).toBe('回旋冰刃');
  });

  it('falls back to sky for unknown theme ids', () => {
    expect(itemName('atlantis', 'uzi')).toBe('冲锋枪');
  });
});
