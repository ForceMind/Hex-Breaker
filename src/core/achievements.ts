/**
 * Achievement definitions and unlock evaluation, kept pure so the whole system
 * is unit-testable. An achievement is unlocked once; the unlock timestamp is
 * persisted in the save file (see services/save.ts `achievements`).
 *
 * Evaluation is snapshot-based: a predicate reads the current SaveData plus an
 * optional run summary (the run that just ended). Keep every number here.
 */

/** Minimal save snapshot the predicates need (structural, matches SaveData). */
export interface AchievementStats {
  highScore: number;
  bestLevel: number;
  gamesPlayed: number;
  totalTilesDestroyed: number;
  campaign: { unlockedLevel: number; records: Record<number, { stars: number }> };
  daily: { streak: number; bestStars: number };
  economy: { coins: number; totalEarned: number };
  unlockedThemes: string[];
}

/** Summary of the run that just ended; omitted fields are treated as 0/false. */
export interface RunSummary {
  mode?: 'level' | 'daily' | 'endless';
  /** True when a boss level (10/20/30) was cleared this run. */
  bossDefeated?: boolean;
  /** Stars earned this run (0 on defeat). */
  stars?: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Coin reward granted once on unlock. */
  reward: number;
  /** Predicate over the current snapshot; true means "should be unlocked". */
  check(stats: AchievementStats, run: RunSummary): boolean;
}

const totalStars = (s: AchievementStats): number =>
  Object.values(s.campaign.records).reduce((sum, r) => sum + (r?.stars ?? 0), 0);

const campaignClears = (s: AchievementStats): number =>
  Object.values(s.campaign.records).filter((r) => (r?.stars ?? 0) > 0).length;

const bossClears = (s: AchievementStats): number =>
  [10, 20, 30].filter((id) => (s.campaign.records[id]?.stars ?? 0) > 0).length;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // --- destruction milestones -------------------------------------------------
  { id: 'tiles-100', name: '初露锋芒', description: '累计消灭 100 块瓦片', reward: 10, check: (s) => s.totalTilesDestroyed >= 100 },
  { id: 'tiles-500', name: '瓦片克星', description: '累计消灭 500 块瓦片', reward: 20, check: (s) => s.totalTilesDestroyed >= 500 },
  { id: 'tiles-2000', name: '粉碎专家', description: '累计消灭 2000 块瓦片', reward: 40, check: (s) => s.totalTilesDestroyed >= 2000 },
  { id: 'tiles-10000', name: '拆迁大队', description: '累计消灭 10000 块瓦片', reward: 100, check: (s) => s.totalTilesDestroyed >= 10000 },
  // --- endless ----------------------------------------------------------------
  { id: 'endless-lv10', name: '小有名气', description: '无尽模式达到 Lv10', reward: 15, check: (s) => s.bestLevel >= 10 },
  { id: 'endless-lv20', name: '深空行者', description: '无尽模式达到 Lv20', reward: 30, check: (s) => s.bestLevel >= 20 },
  { id: 'endless-lv30', name: '地狱常客', description: '无尽模式达到 Lv30', reward: 60, check: (s) => s.bestLevel >= 30 },
  { id: 'endless-score-500', name: '百分俱乐部', description: '无尽模式单局得分 500', reward: 50, check: (s) => s.highScore >= 500 },
  // --- campaign ---------------------------------------------------------------
  { id: 'campaign-10', name: '前十关', description: '通关战役第 10 关', reward: 20, check: (s) => (s.campaign.records[10]?.stars ?? 0) > 0 },
  { id: 'campaign-20', name: '前二十关', description: '通关战役第 20 关', reward: 30, check: (s) => (s.campaign.records[20]?.stars ?? 0) > 0 },
  { id: 'campaign-30', name: '战役通关', description: '通关战役第 30 关', reward: 80, check: (s) => (s.campaign.records[30]?.stars ?? 0) > 0 },
  { id: 'boss-first', name: 'BOSS 猎手', description: '首次击败任意 BOSS', reward: 20, check: (s, r) => bossClears(s) > 0 || r.bossDefeated === true },
  { id: 'boss-all', name: '屠龙勇士', description: '击败全部 3 个 BOSS', reward: 60, check: (s) => bossClears(s) >= 3 },
  { id: 'stars-30', name: '完美主义', description: '战役累计获得 30 颗星', reward: 40, check: (s) => totalStars(s) >= 30 },
  { id: 'stars-90', name: '全星收集', description: '战役累计获得 90 颗星（全 3 星）', reward: 120, check: (s) => totalStars(s) >= 90 },
  { id: 'flawless', name: '毫发无损', description: '以 3 星评价通关任意战役关卡', reward: 15, check: (s) => Object.values(s.campaign.records).some((r) => (r?.stars ?? 0) >= 3) },
  // --- daily ------------------------------------------------------------------
  { id: 'daily-streak-3', name: '三日打卡', description: '每日挑战连续打卡 3 天', reward: 15, check: (s) => s.daily.streak >= 3 },
  { id: 'daily-streak-7', name: '七日之约', description: '每日挑战连续打卡 7 天', reward: 30, check: (s) => s.daily.streak >= 7 },
  { id: 'daily-streak-30', name: '月度劳模', description: '每日挑战连续打卡 30 天', reward: 100, check: (s) => s.daily.streak >= 30 },
  // --- collection / economy ---------------------------------------------------
  { id: 'themes-2', name: '换新装', description: '解锁 2 套主题皮肤', reward: 15, check: (s) => s.unlockedThemes.length >= 2 },
  { id: 'themes-4', name: '收藏家', description: '解锁 4 套主题皮肤', reward: 30, check: (s) => s.unlockedThemes.length >= 4 },
  { id: 'themes-8', name: '全皮肤制霸', description: '解锁全部 8 套主题皮肤', reward: 100, check: (s) => s.unlockedThemes.length >= 8 },
  { id: 'coins-500', name: '小有积蓄', description: '累计获得 500 金币', reward: 20, check: (s) => s.economy.totalEarned >= 500 },
  { id: 'coins-2000', name: '富甲一方', description: '累计获得 2000 金币', reward: 50, check: (s) => s.economy.totalEarned >= 2000 },
  // --- dedication ---------------------------------------------------------------
  { id: 'games-10', name: '熟能生巧', description: '累计游玩 10 局', reward: 10, check: (s) => s.gamesPlayed >= 10 },
  { id: 'games-50', name: '百战老兵', description: '累计游玩 50 局', reward: 25, check: (s) => s.gamesPlayed >= 50 },
  { id: 'games-200', name: '忠实玩家', description: '累计游玩 200 局', reward: 60, check: (s) => s.gamesPlayed >= 200 },
] as const;

export const ACHIEVEMENT_MAP: ReadonlyMap<string, AchievementDef> = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/**
 * Evaluate every locked achievement against the current snapshot and return
 * the defs that newly pass. Already-unlocked ids (present in `unlocked`) are
 * skipped, so each achievement fires exactly once.
 */
export function checkAchievements(
  stats: AchievementStats,
  unlocked: Record<string, number>,
  run: RunSummary = {},
): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const def of ACHIEVEMENTS) {
    if (unlocked[def.id] !== undefined) continue;
    if (def.check(stats, run)) out.push(def);
  }
  return out;
}

/** Total coins granted by a set of freshly unlocked achievements. */
export function achievementCoinReward(defs: readonly AchievementDef[]): number {
  return defs.reduce((sum, d) => sum + d.reward, 0);
}
