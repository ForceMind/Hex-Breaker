import { describe, expect, it } from 'vitest';
import { MAX_BULLET_SIZE_BOOST, SHIELD_FRAMES } from '../src/core/config';
import {
  applyPerk,
  availablePerks,
  PERK_FIRE_RATE_MIN,
  PERK_FIRE_RATE_STEP,
  PERKS,
  rollPerkChoices,
  type PerkState,
} from '../src/core/perks';
import { mulberry32 } from '../src/core/prng';

function baseState(): PerkState {
  return { fireRateBoost: 1, bulletSizeBoost: 0, pierceBoost: 0, speedBoost: 0, weaponDurationBoost: 1, shield: false, shieldDuration: 0 };
}

describe('perks', () => {
  it('offers all six perks on a fresh run', () => {
    expect(availablePerks(baseState())).toHaveLength(PERKS.length);
  });

  it('excludes maxed-out perks from the pool', () => {
    const s = baseState();
    s.fireRateBoost = PERK_FIRE_RATE_MIN;
    s.bulletSizeBoost = MAX_BULLET_SIZE_BOOST;
    s.shield = true;
    s.shieldDuration = 100;
    const ids = availablePerks(s).map((p) => p.id);
    expect(ids).not.toContain('firerate');
    expect(ids).not.toContain('bigshot');
    expect(ids).not.toContain('shield');
    expect(ids).toContain('pierce');
    expect(ids).toContain('speed');
    expect(ids).toContain('duration');
  });

  it('shield re-enters the pool once it expires', () => {
    const s = baseState();
    s.shield = true;
    s.shieldDuration = 0;
    expect(availablePerks(s).map((p) => p.id)).toContain('shield');
  });

  it('rolls two distinct choices from the pool', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const picks = rollPerkChoices(baseState(), rng);
      expect(picks).toHaveLength(2);
      expect(picks[0]!.id).not.toBe(picks[1]!.id);
    }
  });

  it('never offers more choices than the pool has perks', () => {
    // With only the three uncapped perks eligible the pool is 3 -> 2 picks;
    // exhaustively capping is impossible in-run, so assert the bound instead.
    const s = baseState();
    s.fireRateBoost = PERK_FIRE_RATE_MIN;
    s.bulletSizeBoost = MAX_BULLET_SIZE_BOOST;
    s.shield = true;
    s.shieldDuration = 100;
    const pool = availablePerks(s);
    expect(pool).toHaveLength(3);
    const picks = rollPerkChoices(s, mulberry32(1));
    expect(picks.length).toBe(Math.min(2, pool.length));
  });

  it('firerate stacks multiplicatively and clamps at the floor', () => {
    const s = baseState();
    applyPerk(s, 'firerate');
    expect(s.fireRateBoost).toBeCloseTo(PERK_FIRE_RATE_STEP);
    for (let i = 0; i < 20; i++) applyPerk(s, 'firerate');
    expect(s.fireRateBoost).toBe(PERK_FIRE_RATE_MIN);
  });

  it('bigshot respects the global bullet-size cap', () => {
    const s = baseState();
    s.bulletSizeBoost = MAX_BULLET_SIZE_BOOST - 1;
    applyPerk(s, 'bigshot');
    expect(s.bulletSizeBoost).toBe(MAX_BULLET_SIZE_BOOST);
  });

  it('pierce / speed / duration stack without a cap', () => {
    const s = baseState();
    applyPerk(s, 'pierce');
    applyPerk(s, 'pierce');
    applyPerk(s, 'speed');
    applyPerk(s, 'duration');
    expect(s.pierceBoost).toBe(2);
    expect(s.speedBoost).toBe(1);
    expect(s.weaponDurationBoost).toBeCloseTo(1.5);
  });

  it('shield grants the standard 5 s shield', () => {
    const s = baseState();
    applyPerk(s, 'shield');
    expect(s.shield).toBe(true);
    expect(s.shieldDuration).toBe(SHIELD_FRAMES);
  });
});
