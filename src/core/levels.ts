/**
 * Campaign (30 handcrafted-by-formula levels) and daily-challenge level
 * definitions. Everything is derived from small formulas so the table is
 * deterministic and testable; `seed` drives the in-run PRNG so a given level
 * plays identically for every player.
 */
import { hashString } from './prng';
import type { PatternType } from './types';

/** One act in a campaign row script, selected by the current kill count. */
export interface LevelAct {
  /** Player-facing cue shown when this act begins. */
  name: string;
  /** Inclusive kill count at which this act becomes active. */
  atKills: number;
  /** Patterns cycled in order for every newly spawned row. */
  patterns: readonly PatternType[];
}

export interface LevelDef {
  /** 1..30 for campaign levels, 0 for the daily challenge. */
  id: number;
  /** Win condition: number of tiles to destroy. Ignored on boss levels. */
  targetKills: number;
  /** Difficulty anchor used as the `level` argument of the health/density/speed formulas. */
  virtualLevel: number;
  /** Upper bound passed as the level argument of availableItems(). */
  itemTierCap: number;
  /** Fixed seed feeding mulberry32 for this level's run. */
  seed: number;
  /** Four-act deterministic row choreography for regular campaign levels. */
  script?: readonly LevelAct[];
  /** Present on boss levels (10/20/30): destroy the boss to win. */
  boss?: { hp: number };
}

export const CAMPAIGN_COUNT = 30;

/** Boss hit points per boss level: L10 / L20 / L30. */
export const BOSS_HP: Readonly<Record<number, number>> = { 10: 150, 20: 300, 30: 500 };

/** Six choreography families; adjacent levels always use different rhythms. */
const SCRIPT_FAMILIES: readonly (readonly Omit<LevelAct, 'atKills'>[])[] = [
  [
    { name: '打开航道', patterns: ['corridor', 'walls'] },
    { name: '侧翼来袭', patterns: ['sides', 'tunnel', 'walls'] },
    { name: '封锁线', patterns: ['barrier', 'gaps', 'barrier'] },
    { name: '突破出口', patterns: ['corridor', 'diamond'] },
  ],
  [
    { name: '锁定核心', patterns: ['center', 'diamond'] },
    { name: '十字火线', patterns: ['cross', 'center', 'cross'] },
    { name: '内外夹击', patterns: ['sides', 'diamond', 'walls'] },
    { name: '击穿核心', patterns: ['center', 'barrier'] },
  ],
  [
    { name: '蛇形航道', patterns: ['zigzag', 'stairs'] },
    { name: '波浪推进', patterns: ['wave', 'zigzag', 'wave'] },
    { name: '隧道急袭', patterns: ['tunnel', 'stairs', 'tunnel'] },
    { name: '冲出迷宫', patterns: ['zigzag', 'corridor'] },
  ],
  [
    { name: '迷阵启动', patterns: ['gaps', 'random'] },
    { name: '真假缺口', patterns: ['barrier', 'gaps', 'random'] },
    { name: '火力迷宫', patterns: ['cross', 'random', 'diamond'] },
    { name: '寻找出口', patterns: ['gaps', 'corridor'] },
  ],
  [
    { name: '两翼压境', patterns: ['walls', 'sides'] },
    { name: '中央反扑', patterns: ['center', 'cross', 'center'] },
    { name: '全面夹击', patterns: ['walls', 'barrier', 'sides'] },
    { name: '正面突围', patterns: ['corridor', 'center'] },
  ],
  [
    { name: '几何风暴', patterns: ['diamond', 'cross'] },
    { name: '图形变换', patterns: ['wave', 'stairs', 'diamond'] },
    { name: '结构过载', patterns: ['barrier', 'cross', 'zigzag'] },
    { name: '风暴之眼', patterns: ['diamond', 'corridor'] },
  ],
];

/** Build four acts at 0%, 25%, 55%, and 80% of the kill target. */
export function buildCampaignScript(id: number, targetKills: number): readonly LevelAct[] {
  const normalizedId = Math.max(1, Math.round(id));
  const family = SCRIPT_FAMILIES[(normalizedId - 1) % SCRIPT_FAMILIES.length] ?? SCRIPT_FAMILIES[0]!;
  const thresholds = [0, Math.ceil(targetKills * 0.25), Math.ceil(targetKills * 0.55), Math.ceil(targetKills * 0.8)];
  // Repeated families rotate their first pattern, so L1/L7/L13 still differ.
  const rotation = Math.floor((normalizedId - 1) / SCRIPT_FAMILIES.length);
  return family.map((act, index) => {
    const shift = (rotation + index) % act.patterns.length;
    const patterns = [...act.patterns.slice(shift), ...act.patterns.slice(0, shift)];
    return { name: act.name, atKills: thresholds[index] ?? 0, patterns };
  });
}

/** Index of the active scripted act, or -1 when this level has no script. */
export function levelActIndexAt(level: LevelDef, kills: number): number {
  if (!level.script?.length) return -1;
  let active = 0;
  for (let i = 1; i < level.script.length; i++) {
    const act = level.script[i];
    if (!act || kills < act.atKills) break;
    active = i;
  }
  return active;
}

/** Deterministic pattern for a newly spawned row in the current act. */
export function levelPatternAt(level: LevelDef, kills: number, rowIndex: number): PatternType | null {
  const actIndex = levelActIndexAt(level, kills);
  const act = actIndex >= 0 ? level.script?.[actIndex] : undefined;
  if (!act?.patterns.length) return null;
  const index = Math.max(0, Math.floor(rowIndex)) % act.patterns.length;
  return act.patterns[index] ?? null;
}

function campaignLevel(id: number): LevelDef {
  const targetKills = 40 + id * 6;
  const def: LevelDef = {
    id,
    targetKills, // L1 = 46 (约 1 分钟) … L30 = 220 (约 3–4 分钟)
    virtualLevel: 1 + Math.floor((id - 1) * 0.9), // L30 ≈ 27
    itemTierCap: Math.min(15, 1 + Math.floor(id / 2)), // L1 = 1, L30 = 15
    seed: id * 7919,
  };
  const bossHp = BOSS_HP[id];
  if (bossHp !== undefined) def.boss = { hp: bossHp };
  else def.script = buildCampaignScript(id, targetKills);
  return def;
}

export const CAMPAIGN_LEVELS: readonly LevelDef[] = Array.from({ length: CAMPAIGN_COUNT }, (_, i) => campaignLevel(i + 1));

export function getCampaignLevel(id: number): LevelDef {
  const clamped = Math.max(1, Math.min(CAMPAIGN_COUNT, Math.round(id)));
  const level = CAMPAIGN_LEVELS[clamped - 1];
  if (!level) throw new Error(`campaign level ${clamped} missing`);
  return level;
}

/** UTC date key in YYYY-MM-DD form; the daily challenge is keyed on it. */
export function utcDateKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The date key of the UTC day before `dateKey` (for streak bookkeeping). */
export function previousDateKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDateKey(d);
}

/** Everyone gets the same daily level: it is a pure function of the date. */
export function dailyLevel(dateKey: string): LevelDef {
  const hash = hashString(dateKey);
  return {
    id: 0,
    virtualLevel: 10 + (hash % 9),
    targetKills: 80 + ((hash >>> 3) % 50),
    itemTierCap: 15,
    seed: hash,
  };
}
