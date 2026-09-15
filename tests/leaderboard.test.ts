import { describe, expect, it } from 'vitest';
import { isoWeekKey, LEADERBOARD_BOTS, PLAYER_NAME, simulateWeek, weekResetMs, weeklyLeaderboard } from '../src/services/leaderboard';

describe('isoWeekKey / weekResetMs', () => {
  it('formats ISO week keys', () => {
    // 2026-09-15 is a Tuesday of ISO week 38.
    expect(isoWeekKey(new Date('2026-09-15T12:00:00Z'))).toBe('2026-W38');
    // Year boundary: 2026-01-01 is a Thursday of ISO week 1.
    expect(isoWeekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    // 2025-12-29 (Monday) belongs to ISO week 1 of 2026.
    expect(isoWeekKey(new Date('2025-12-29T00:00:00Z'))).toBe('2026-W01');
  });

  it('reset is the next Monday 00:00 UTC, always in the future', () => {
    const now = new Date('2026-09-15T12:00:00Z'); // Tuesday
    const reset = weekResetMs(now);
    expect(reset).toBe(Date.UTC(2026, 8, 21)); // Monday 2026-09-21
    expect(reset).toBeGreaterThan(now.getTime());
    // On Monday exactly midnight, the next reset is a full week away.
    expect(weekResetMs(new Date('2026-09-21T00:00:00Z'))).toBe(Date.UTC(2026, 8, 28));
  });
});

describe('simulateWeek', () => {
  it('is deterministic: same week -> identical board', () => {
    expect(simulateWeek('2026-W38')).toEqual(simulateWeek('2026-W38'));
  });

  it('rotates with the week and keeps 100 uniquely-named bots', () => {
    const a = simulateWeek('2026-W38');
    const b = simulateWeek('2026-W39');
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(LEADERBOARD_BOTS);
    expect(new Set(a.map((r) => r.name)).size).toBe(LEADERBOARD_BOTS);
  });

  it('follows the power-law shape: most 50-400, top reaches four digits', () => {
    const scores = simulateWeek('2026-W38').map((r) => r.score);
    const mid = scores.filter((s) => s >= 50 && s <= 400).length;
    expect(mid).toBeGreaterThan(60);
    expect(Math.max(...scores)).toBeGreaterThan(1000);
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(10);
    // Never scaled off any player score: scores stay inside the fixed curve.
    expect(Math.max(...scores)).toBeLessThan(1600);
  });
});

describe('weeklyLeaderboard player insertion', () => {
  it('inserts the player at the right rank and flags the row', () => {
    const board = weeklyLeaderboard(0, new Date('2026-09-15T12:00:00Z'));
    expect(board.rows).toHaveLength(LEADERBOARD_BOTS + 1);
    const player = board.rows.find((r) => r.isPlayer);
    expect(player?.name).toBe(PLAYER_NAME);
    expect(player?.rank).toBe(LEADERBOARD_BOTS + 1); // score 0 lands last
    // ranks are dense and sorted desc
    board.rows.forEach((r, i) => {
      expect(r.rank).toBe(i + 1);
      if (i > 0) expect(board.rows[i - 1]?.score ?? 0).toBeGreaterThanOrEqual(r.score);
    });
  });

  it('a huge score takes rank 1; a mid score lands mid-field', () => {
    const top = weeklyLeaderboard(99999, new Date('2026-09-15T12:00:00Z'));
    expect(top.rows[0]?.isPlayer).toBe(true);
    expect(top.rows[0]?.rank).toBe(1);
    const mid = weeklyLeaderboard(300, new Date('2026-09-15T12:00:00Z'));
    const player = mid.rows.find((r) => r.isPlayer);
    expect(player).toBeTruthy();
    const above = mid.rows.filter((r) => r.score > 300 && !r.isPlayer).length;
    expect(player?.rank).toBe(above + 1);
  });
});
