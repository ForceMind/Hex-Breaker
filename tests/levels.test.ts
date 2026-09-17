import { describe, expect, it } from 'vitest';
import {
  buildCampaignScript,
  CAMPAIGN_COUNT,
  CAMPAIGN_LEVELS,
  dailyLevel,
  getCampaignLevel,
  levelActIndexAt,
  levelPatternAt,
  previousDateKey,
  utcDateKey,
} from '../src/core/levels';

describe('CAMPAIGN_LEVELS', () => {
  it('has exactly 30 levels with sequential ids', () => {
    expect(CAMPAIGN_LEVELS).toHaveLength(30);
    CAMPAIGN_LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
  });

  it('follows the formula table', () => {
    expect(CAMPAIGN_LEVELS[0]).toMatchObject({ id: 1, targetKills: 46, virtualLevel: 1, itemTierCap: 1, seed: 7919 });
    const last = CAMPAIGN_LEVELS[CAMPAIGN_COUNT - 1];
    expect(last?.targetKills).toBe(220);
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

  it('marks levels 10/20/30 as boss levels with increasing hp', () => {
    const bosses = CAMPAIGN_LEVELS.filter((l) => l.boss);
    expect(bosses.map((l) => l.id)).toEqual([10, 20, 30]);
    expect(bosses[0]?.boss?.hp).toBe(150);
    expect(bosses[1]?.boss?.hp).toBe(300);
    expect(bosses[2]?.boss?.hp).toBe(500);
    // hp strictly increases, and non-boss levels carry no boss field
    expect(bosses[0]!.boss!.hp).toBeLessThan(bosses[1]!.boss!.hp);
    expect(bosses[1]!.boss!.hp).toBeLessThan(bosses[2]!.boss!.hp);
    expect(CAMPAIGN_LEVELS[0]?.boss).toBeUndefined();
    expect(dailyLevel('2026-04-09').boss).toBeUndefined();
  });

  it('gives every regular campaign level a four-act script but leaves bosses unscripted', () => {
    const regular = CAMPAIGN_LEVELS.filter((l) => !l.boss);
    expect(regular).toHaveLength(27);
    regular.forEach((level) => {
      expect(level.script).toHaveLength(4);
      expect(level.script?.map((act) => act.atKills)).toEqual([
        0,
        Math.ceil(level.targetKills * 0.25),
        Math.ceil(level.targetKills * 0.55),
        Math.ceil(level.targetKills * 0.8),
      ]);
      level.script?.forEach((act) => expect(act.patterns.length).toBeGreaterThanOrEqual(2));
    });
    expect(CAMPAIGN_LEVELS.filter((l) => l.boss).every((l) => l.script === undefined)).toBe(true);
  });

  it('selects acts at kill thresholds and cycles row patterns deterministically', () => {
    const level = getCampaignLevel(1);
    expect(levelActIndexAt(level, 0)).toBe(0);
    expect(levelActIndexAt(level, 11)).toBe(0);
    expect(levelActIndexAt(level, 12)).toBe(1);
    expect(levelActIndexAt(level, 26)).toBe(2);
    expect(levelActIndexAt(level, 37)).toBe(3);

    const firstAct = level.script?.[0];
    expect(firstAct).toBeDefined();
    expect(levelPatternAt(level, 0, 0)).toBe(firstAct?.patterns[0]);
    expect(levelPatternAt(level, 0, firstAct?.patterns.length ?? 0)).toBe(firstAct?.patterns[0]);
    expect(levelPatternAt(getCampaignLevel(10), 0, 0)).toBeNull();
    expect(levelPatternAt(dailyLevel('2026-04-09'), 0, 0)).toBeNull();
  });

  it('rotates repeated choreography families across later levels', () => {
    const l1 = buildCampaignScript(1, 46);
    const l7 = buildCampaignScript(7, 82);
    expect(l1[0]?.name).toBe(l7[0]?.name);
    expect(l1[0]?.patterns).not.toEqual(l7[0]?.patterns);
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
