import { MAX_BULLET_SIZE_BOOST, SHIELD_FRAMES } from './config';

/**
 * Level-up perks: instead of a flat coin grant, levelling pauses the run and
 * offers two random perks to pick from (8 s countdown auto-picks one). All
 * effects reuse the existing run-time knobs — no new systems.
 */
export type PerkId = 'firerate' | 'bigshot' | 'pierce' | 'speed' | 'duration' | 'shield';

export interface PerkDef {
  id: PerkId;
  name: string;
  desc: string;
}

export const PERKS: readonly PerkDef[] = [
  { id: 'firerate', name: '火力全开', desc: '全部武器射速提升 15%' },
  { id: 'bigshot', name: '重弹头', desc: '子弹尺寸 +2' },
  { id: 'pierce', name: '幽灵弹', desc: '子弹额外穿透 1 个目标' },
  { id: 'speed', name: '疾风靴', desc: '移动速度 +1' },
  { id: 'duration', name: '持久武器', desc: '特殊武器时长 +50%' },
  { id: 'shield', name: '应急护盾', desc: '立即获得 5 秒护盾' },
];

/** Fire-rate multiplier applied per firerate pick (multiplicative). */
export const PERK_FIRE_RATE_STEP = 0.85;
/** Hard floor so stacked picks can never make cooldowns degenerate. */
export const PERK_FIRE_RATE_MIN = 0.55;
export const PERK_BULLET_SIZE_STEP = 2;
export const PERK_SPEED_STEP = 1;
export const PERK_DURATION_STEP = 0.5;
export const PERK_SHIELD_FRAMES = SHIELD_FRAMES;
/** Countdown on the pick overlay, in frames (8 s at 60 fps). */
export const PERK_PICK_FRAMES = 480;

/** Run-state slice the perk pool/apply logic needs. */
export interface PerkState {
  fireRateBoost: number;
  bulletSizeBoost: number;
  pierceBoost: number;
  speedBoost: number;
  weaponDurationBoost: number;
  shield: boolean;
  shieldDuration: number;
}

/** Perks currently worth offering (maxed-out ones are excluded). */
export function availablePerks(s: PerkState): PerkDef[] {
  return PERKS.filter((p) => {
    switch (p.id) {
      case 'firerate':
        return s.fireRateBoost > PERK_FIRE_RATE_MIN + 1e-6;
      case 'bigshot':
        return s.bulletSizeBoost < MAX_BULLET_SIZE_BOOST;
      case 'shield':
        return !s.shield || s.shieldDuration <= 0;
      default:
        return true; // pierce / speed / duration stack without a cap
    }
  });
}

/** Two distinct random perks from the available pool (fewer if it is small). */
export function rollPerkChoices(state: PerkState, rng: () => number): PerkDef[] {
  const pool = [...availablePerks(state)];
  const picks: PerkDef[] = [];
  while (picks.length < 2 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    const [pick] = pool.splice(i, 1);
    if (pick) picks.push(pick);
  }
  return picks;
}

/** Apply a picked perk to the run state (mutates and returns it). */
export function applyPerk(s: PerkState, id: PerkId): PerkState {
  switch (id) {
    case 'firerate':
      s.fireRateBoost = Math.max(PERK_FIRE_RATE_MIN, s.fireRateBoost * PERK_FIRE_RATE_STEP);
      break;
    case 'bigshot':
      s.bulletSizeBoost = Math.min(MAX_BULLET_SIZE_BOOST, s.bulletSizeBoost + PERK_BULLET_SIZE_STEP);
      break;
    case 'pierce':
      s.pierceBoost += 1;
      break;
    case 'speed':
      s.speedBoost += PERK_SPEED_STEP;
      break;
    case 'duration':
      s.weaponDurationBoost += PERK_DURATION_STEP;
      break;
    case 'shield':
      s.shield = true;
      s.shieldDuration = PERK_SHIELD_FRAMES;
      break;
  }
  return s;
}
