import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_MAP,
  ACHIEVEMENTS,
  achievementCoinReward,
  checkAchievements,
  type AchievementStats,
} from '../src/core/achievements';
import { defaultSave } from '../src/services/save';

/** Build a fresh stats snapshot from the default save. */
const baseStats = (): AchievementStats => defaultSave();

describe('achievement table', () => {
  it('has unique ids and positive rewards', () => {
    const ids = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.reward).toBeGreaterThan(0);
      expect(ACHIEVEMENT_MAP.get(a.id)).toBe(a);
    }
  });

  it('a fresh save unlocks nothing', () => {
    expect(checkAchievements(baseStats(), {})).toEqual([]);
  });
});

describe('checkAchievements', () => {
  it('unlocks tile milestones by cumulative destruction', () => {
    const s = baseStats();
    s.totalTilesDestroyed = 500;
    const unlocked = checkAchievements(s, {});
    expect(unlocked.map((a) => a.id)).toEqual(['tiles-100', 'tiles-500']);
  });

  it('unlocks endless milestones by bestLevel / highScore', () => {
    const s = baseStats();
    s.bestLevel = 30;
    s.highScore = 600;
    const ids = checkAchievements(s, {}).map((a) => a.id);
    expect(ids).toContain('endless-lv10');
    expect(ids).toContain('endless-lv20');
    expect(ids).toContain('endless-lv30');
    expect(ids).toContain('endless-score-500');
  });

  it('unlocks campaign / boss / star achievements from records', () => {
    const s = baseStats();
    s.campaign.records = {
      10: { stars: 3 },
      20: { stars: 2 },
      30: { stars: 1 },
    };
    const ids = checkAchievements(s, {}).map((a) => a.id);
    expect(ids).toContain('campaign-10');
    expect(ids).toContain('campaign-20');
    expect(ids).toContain('campaign-30');
    expect(ids).toContain('boss-first');
    expect(ids).toContain('boss-all');
    expect(ids).toContain('flawless'); // a 3-star record exists
  });

  it('boss-first also fires from the run summary (same-run unlock)', () => {
    const s = baseStats();
    const ids = checkAchievements(s, {}, { mode: 'level', bossDefeated: true }).map((a) => a.id);
    expect(ids).toContain('boss-first');
    expect(ids).not.toContain('boss-all');
  });

  it('counts total stars across records', () => {
    const s = baseStats();
    for (let id = 1; id <= 30; id++) s.campaign.records[id] = { stars: 3 };
    const ids = checkAchievements(s, {}).map((a) => a.id);
    expect(ids).toContain('stars-30');
    expect(ids).toContain('stars-90');
  });

  it('unlocks daily streak tiers', () => {
    const s = baseStats();
    s.daily.streak = 7;
    const ids = checkAchievements(s, {}).map((a) => a.id);
    expect(ids).toContain('daily-streak-3');
    expect(ids).toContain('daily-streak-7');
    expect(ids).not.toContain('daily-streak-30');
  });

  it('unlocks theme collection tiers', () => {
    const s = baseStats();
    s.unlockedThemes = ['sky', 'forest', 'sunset', 'ocean'];
    const ids = checkAchievements(s, {}).map((a) => a.id);
    expect(ids).toContain('themes-2');
    expect(ids).toContain('themes-4');
    expect(ids).not.toContain('themes-8');
  });

  it('unlocks coin milestones by totalEarned (not current balance)', () => {
    const s = baseStats();
    s.economy.coins = 10; // spent almost everything
    s.economy.totalEarned = 600;
    const ids = checkAchievements(s, {}).map((a) => a.id);
    expect(ids).toContain('coins-500');
    expect(ids).not.toContain('coins-2000');
  });

  it('unlocks dedication tiers by gamesPlayed', () => {
    const s = baseStats();
    s.gamesPlayed = 50;
    const ids = checkAchievements(s, {}).map((a) => a.id);
    expect(ids).toContain('games-10');
    expect(ids).toContain('games-50');
    expect(ids).not.toContain('games-200');
  });

  it('skips already-unlocked achievements (fires exactly once)', () => {
    const s = baseStats();
    s.totalTilesDestroyed = 2000;
    const first = checkAchievements(s, {});
    expect(first.map((a) => a.id)).toEqual(['tiles-100', 'tiles-500', 'tiles-2000']);
    const again = checkAchievements(s, { 'tiles-100': 1, 'tiles-500': 1, 'tiles-2000': 1 });
    expect(again).toEqual([]);
  });
});

describe('achievementCoinReward', () => {
  it('sums rewards of newly unlocked defs', () => {
    const defs = [ACHIEVEMENT_MAP.get('tiles-100')!, ACHIEVEMENT_MAP.get('endless-lv10')!];
    expect(achievementCoinReward(defs)).toBe(10 + 15);
    expect(achievementCoinReward([])).toBe(0);
  });
});
