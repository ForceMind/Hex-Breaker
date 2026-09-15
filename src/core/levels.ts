/**
 * Campaign (30 handcrafted-by-formula levels) and daily-challenge level
 * definitions. Everything is derived from small formulas so the table is
 * deterministic and testable; `seed` drives the in-run PRNG so a given level
 * plays identically for every player.
 */
import { hashString } from './prng';

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
  /** Present on boss levels (10/20/30): destroy the boss to win. */
  boss?: { hp: number };
}

export const CAMPAIGN_COUNT = 30;

/** Boss hit points per boss level: L10 / L20 / L30. */
export const BOSS_HP: Readonly<Record<number, number>> = { 10: 150, 20: 300, 30: 500 };

function campaignLevel(id: number): LevelDef {
  const def: LevelDef = {
    id,
    targetKills: 40 + id * 6, // L1 = 46 (约 1 分钟) … L30 = 220 (约 3–4 分钟)
    virtualLevel: 1 + Math.floor((id - 1) * 0.9), // L30 ≈ 27
    itemTierCap: Math.min(15, 1 + Math.floor(id / 2)), // L1 = 1, L30 = 15
    seed: id * 7919,
  };
  const bossHp = BOSS_HP[id];
  if (bossHp !== undefined) def.boss = { hp: bossHp };
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
