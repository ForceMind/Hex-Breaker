/**
 * Every gameplay number from the original single-file demo, collected into
 * tables. Frame-based timings assume a 60 fps loop (1 frame = 1/60 s), exactly
 * as in the original.
 */
import type { BombParams, BombType, ItemType, PatternType, SpecialWeaponType, WeaponType } from './types';

// --- board / flow ------------------------------------------------------------
export const TILE_SIZE = 50;
export const TILE_SPACING = 55;
export const INITIAL_ROWS = 4;
/** Initial tiles roll health uniformly in [1, INITIAL_HEALTH_MAX]. */
export const INITIAL_HEALTH_MAX = 2;
/** Y of the first row when the board is empty / at start. */
export const FIRST_ROW_Y = 10;

export const START_LIVES = 3;
export const MAX_LIVES = 9;
/** Invincibility (granted as a temporary shield) after losing a life. */
export const INVINCIBLE_FRAMES = 120;
export const SCORE_PER_LEVEL = 8;
export const SPEED_PER_LEVEL = 0.09;
// Level-ups grant a pick-one-of-two perk instead of coins (see core/perks.ts).

// --- player ------------------------------------------------------------------
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 40;
export const PLAYER_SPEED = 5;
export const PLAYER_BOTTOM_MARGIN = 60;
export const MAX_BULLET_SIZE_BOOST = 8;
export const MAGNET_STEP = 50;
export const MAGNET_FORCE = 0.3;
export const SPEED_BOOST_STEP = 2;
export const WEAPON_DURATION_STEP = 0.5;

// --- weapons -----------------------------------------------------------------
export const WEAPON_MAX_LEVEL = 5;
export const WEAPON_BASE_DURATION = 600;
export const WEAPON_LEVEL_DURATION = 60;
export const WEAPON_DURATION_BONUS: Record<SpecialWeaponType, number> = {
  uzi: 0,
  shotgun: 60,
  laser: 120,
  spread: 90,
};
/** Global minimum frames between any two volleys. */
export const GLOBAL_SHOT_COOLDOWN = 3;

export const WEAPON_NAMES: Record<WeaponType, string> = {
  default: '默认',
  uzi: '冲锋枪',
  shotgun: '霰弹枪',
  laser: '激光炮',
  spread: '散射枪',
};

export const WEAPON_BAR_COLORS: Record<SpecialWeaponType, number> = {
  uzi: 0xff6600,
  shotgun: 0xff0066,
  laser: 0x0066ff,
  spread: 0x66ff00,
};

/** Per-weapon frames between volleys, before the rapid-fire multiplier. */
export function weaponBaseCooldown(type: WeaponType, level: number): number {
  switch (type) {
    case 'default':
      return 30;
    case 'uzi':
      return Math.max(3, 8 - level);
    case 'shotgun':
      return Math.max(25, 40 - level * 2);
    case 'laser':
      return Math.max(35, 50 - level * 3);
    case 'spread':
      return Math.max(12, 25 - level * 2);
  }
}

/** Cooldown actually applied, with the rapid-fire permanent halving it. */
export function weaponCooldown(type: WeaponType, level: number, rapidFire: boolean): number {
  return Math.floor(weaponBaseCooldown(type, level) * (rapidFire ? 0.5 : 1));
}

/** Weapon duration in frames: 600 + level*60 + weapon bonus, scaled by the boost. */
export function weaponDuration(type: SpecialWeaponType, level: number, durationBoost: number): number {
  const total = WEAPON_BASE_DURATION + level * WEAPON_LEVEL_DURATION + WEAPON_DURATION_BONUS[type];
  return Math.floor(total * durationBoost);
}

// --- bullets -----------------------------------------------------------------
export const BULLET_SPEED = 8;
export const LASER_SPEED = 12;
export const BULLET_RADIUS: Record<'normal' | 'laser' | 'small' | 'big', number> = {
  normal: 4,
  laser: 6,
  small: 3,
  big: 8,
};
export const BULLET_COLORS: Record<'normal' | 'laser' | 'small' | 'big', number> = {
  normal: 0x00c853,
  laser: 0xff0066,
  small: 0x00ccff,
  big: 0xffb300,
};
export const LASER_DAMAGE = 3;
export const PIERCING_MAX_HITS = 3;

// --- bombs -------------------------------------------------------------------
export const BOMB_PARAMS: Record<BombType, BombParams> = {
  normal: { speed: 6, explosionRadius: 80, baseDamage: 4, dirX: 0, dirY: -1, randomSignX: false, bodyRadius: 8, isLine: false, color: 0xff4444, name: '普通炸弹' },
  big: { speed: 5, explosionRadius: 120, baseDamage: 8, dirX: 0, dirY: -1, randomSignX: false, bodyRadius: 12, isLine: false, color: 0xff8800, name: '大型炸弹' },
  diagonal: { speed: 7, explosionRadius: 70, baseDamage: 4, dirX: 0.7, dirY: -0.7, randomSignX: true, bodyRadius: 8, isLine: false, color: 0xff00ff, name: '斜射炸弹' },
  horizontal: { speed: 6, explosionRadius: 60, baseDamage: 4, dirX: 1, dirY: 0, randomSignX: true, bodyRadius: 8, isLine: false, color: 0x00c5cd, name: '横向炸弹' },
  line: { speed: 8, explosionRadius: 40, baseDamage: 6, dirX: 0, dirY: -1, randomSignX: false, bodyRadius: 8, isLine: true, color: 0xff4488, name: '线性炸弹' },
};
export const EXPLOSION_FRAMES = 20;
export const BOMB_MIN_DAMAGE = 2;
/** Line bombs hit tiles within +-30 px horizontally of the bomb's x. */
export const LINE_BOMB_HALF_WIDTH = 30;

// --- boomerang ---------------------------------------------------------------
export const BOOMERANG = {
  speed: 6,
  radius: 15,
  maxTime: 120,
  arcHeight: 120,
  arcWidth: 150,
  damage: 2,
  catchDistance: 30,
  arriveDistance: 20,
  returnSpeedScale: 1.5,
} as const;

// --- shields -----------------------------------------------------------------
export const SHIELD_FRAMES = 300;
export const STRONG_SHIELD_FRAMES = 600;

// --- items / drops -------------------------------------------------------------
/** Drop probability per destroyed tile: min(0.22, 0.055 + level*0.015). */
export function dropChance(level: number): number {
  return Math.min(0.22, 0.055 + level * 0.015);
}

/**
 * Level-gated item unlock table. Each tier adds to the pool; `bigbullets` is
 * additionally suppressed once the bullet-size cap is reached.
 */
export const ITEM_UNLOCK_TIERS: readonly { level: number; items: readonly ItemType[] }[] = [
  { level: 1, items: ['uzi', 'bomb', 'shield'] },
  { level: 3, items: ['shotgun', 'boomerang'] },
  { level: 5, items: ['laser', 'bigbomb'] },
  { level: 7, items: ['spread', 'diagonalbomb', 'horizontalbomb'] },
  { level: 9, items: ['linebomb', 'speedboost'] },
  { level: 11, items: ['doublebullets', 'rapidfire'] },
  { level: 13, items: ['piercing', 'magnet', 'bigbullets'] },
  { level: 15, items: ['shieldbooster', 'weaponduration', 'extralife'] },
];

export function availableItems(level: number, bulletSizeBoost: number): ItemType[] {
  const out: ItemType[] = [];
  for (const tier of ITEM_UNLOCK_TIERS) {
    if (level < tier.level) continue;
    for (const item of tier.items) {
      if (item === 'bigbullets' && bulletSizeBoost >= MAX_BULLET_SIZE_BOOST) continue;
      out.push(item);
    }
  }
  return out;
}

export const ITEM_META: Record<ItemType, { name: string; color: number; textColor: number }> = {
  uzi: { name: '冲锋枪', color: 0xff6600, textColor: 0xffffff },
  shotgun: { name: '霰弹枪', color: 0x8b4513, textColor: 0xffffff },
  laser: { name: '激光炮', color: 0xff0066, textColor: 0xffffff },
  spread: { name: '散射枪', color: 0x00ccff, textColor: 0x17364f },
  bomb: { name: '炸弹', color: 0xff0000, textColor: 0xffffff },
  bigbomb: { name: '大炸弹', color: 0xff8800, textColor: 0xffffff },
  diagonalbomb: { name: '斜炸弹', color: 0xff00ff, textColor: 0xffffff },
  horizontalbomb: { name: '横炸弹', color: 0x00c5cd, textColor: 0x17364f },
  linebomb: { name: '线炸弹', color: 0xff4488, textColor: 0xffffff },
  shield: { name: '护盾', color: 0x00c5cd, textColor: 0x17364f },
  boomerang: { name: '回旋镖', color: 0xffdd00, textColor: 0x17364f },
  doublebullets: { name: '双子弹', color: 0xffd700, textColor: 0x17364f },
  speedboost: { name: '加速', color: 0x00ff88, textColor: 0x17364f },
  rapidfire: { name: '连射', color: 0xff4400, textColor: 0xffffff },
  piercing: { name: '穿透', color: 0x8866ff, textColor: 0xffffff },
  shieldbooster: { name: '护盾+', color: 0xff69b4, textColor: 0xffffff },
  magnet: { name: '磁力', color: 0x4169e1, textColor: 0xffffff },
  bigbullets: { name: '大弹', color: 0x32cd32, textColor: 0x17364f },
  weaponduration: { name: '持久', color: 0xffa500, textColor: 0x17364f },
  extralife: { name: '生命', color: 0xff1493, textColor: 0xffffff },
};

export const ITEM_DROP_SIZE = 30;
export const ITEM_DROP_SPEED = 2;

// --- row patterns --------------------------------------------------------------
export const SHAPED_ROW_MIN_LEVEL = 3;
export const SHAPED_ROW_CHANCE = 0.8;

export const PATTERN_NAMES: Record<PatternType, string> = {
  corridor: '走廊',
  walls: '墙壁',
  center: '中央',
  sides: '两侧',
  gaps: '间隙',
  zigzag: '之字',
  diamond: '菱形',
  wave: '波浪',
  tunnel: '隧道',
  stairs: '阶梯',
  cross: '十字',
  random: '随机',
  barrier: '障碍',
};
/** Display name for the classic full row. */
export const FULL_ROW_NAME = '传统';
