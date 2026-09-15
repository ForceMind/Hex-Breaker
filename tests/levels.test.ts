import { describe, expect, it } from 'vitest';
import { CAMPAIGN_COUNT, CAMPAIGN_LEVELS, dailyLevel, getCampaignLevel, previousDateKey, utcDateKey } from '../src/core/levels';

describe('CAMPAIGN_LEVELS', () => {
  it('has exactly 30 levels with sequential ids', () => {
    expect(CAMPAIGN_LEVELS).toHaveLength(30);
    CAMPAIGN_LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
  });

  it('follows the formula table', () => {
    expect(CAMPAIGN_LEVELS[0]).toEqual({ id: 1, targetKills: 24, virtualLevel: 1, itemTierCap: 1, seed: 7919 });
    const last = CAMPAIGN_LEVELS[CAMPAIGN_COUNT - 1];
    expect(last?.targetKills).toBe(140);
    expect(last?.virtualLevel).toBe(27);
    expect(last?.itemTierCap).toBe(15);
    expect(last?.seed).toBe(30 * 7919);
  });

  it('is monotonically non-decreasing in difficulty anchors', () => {
    for (let i = 1; i < CAMPAIGN_LEVELS.length; i++) {
      const prev = CAMPAIGN_LEVELS[i - 1];
      const cur = CAMPAIGN_LEVELS[i];
      expect(cur?.targetKills).toBeGreaterThan(prev?.targetKills ?? 0);
      expect(cur?.virtualLevel).toBeGreaterThanOrEqual(prev?.virtualLevel ?? 0);
      expect(cur?.itemTierCap).toBeGreaterThanOrEqual(prev?.itemTierCap ?? 0);
    }
  });

  it('getCampaignLevel clamps out-of-range ids', () => {
    expect(getCampaignLevel(0).id).toBe(1);
    expect(getCampaignLevel(99).id).toBe(30);
    expect(getCampaignLevel(12).id).toBe(12);
  });
});

describe('dailyLevel', () => {
  it('is deterministic per date key', () => {
    expect(dailyLevel('2026-04-09')).toEqual(dailyLevel('2026-04-09'));
  });

  it('varies between dates and stays inside its ranges', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const key = `2026-03-${String(day).padStart(2, '0')}`;
      const l = dailyLevel(key);
      expect(l.id).toBe(0);
      expect(l.itemTierCap).toBe(15);
      expect(l.virtualLevel).toBeGreaterThanOrEqual(10);
      expect(l.virtualLevel).toBeLessThanOrEqual(18);
      expect(l.targetKills).toBeGreaterThanOrEqual(80);
      expect(l.targetKills).toBeLessThan(130);
      seen.add(`${l.virtualLevel}/${l.targetKills}`);
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('date keys', () => {
  it('utcDateKey formats YYYY-MM-DD in UTC', () => {
    expect(utcDateKey(new Date('2026-01-05T23:30:00Z'))).toBe('2026-01-05');
  });

  it('previousDateKey rolls back one UTC day, across months and years', () => {
    expect(previousDateKey('2026-03-02')).toBe('2026-03-01');
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31');
  });
});
