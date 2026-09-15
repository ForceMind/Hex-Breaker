/** Shared enums and interfaces for the pure game logic (no Phaser imports). */

export type WeaponType = 'default' | 'uzi' | 'shotgun' | 'laser' | 'spread';
export type SpecialWeaponType = Exclude<WeaponType, 'default'>;

export const SPECIAL_WEAPONS: readonly SpecialWeaponType[] = ['uzi', 'shotgun', 'laser', 'spread'];
export const WEAPON_TYPES: readonly WeaponType[] = ['default', ...SPECIAL_WEAPONS];

export type BombType = 'normal' | 'big' | 'diagonal' | 'horizontal' | 'line';

export type BulletKind = 'normal' | 'laser' | 'small' | 'big';

export type ItemType =
  | SpecialWeaponType
  | 'bomb'
  | 'bigbomb'
  | 'diagonalbomb'
  | 'horizontalbomb'
  | 'linebomb'
  | 'shield'
  | 'boomerang'
  | 'doublebullets'
  | 'speedboost'
  | 'rapidfire'
  | 'piercing'
  | 'shieldbooster'
  | 'magnet'
  | 'bigbullets'
  | 'weaponduration'
  | 'extralife';

export type PatternType =
  | 'corridor'
  | 'walls'
  | 'center'
  | 'sides'
  | 'gaps'
  | 'zigzag'
  | 'diamond'
  | 'wave'
  | 'tunnel'
  | 'stairs'
  | 'cross'
  | 'random'
  | 'barrier';

export interface WeaponState {
  active: boolean;
  level: number;
  duration: number;
  maxDuration: number;
  cooldown: number;
}

/** The subset of player state the difficulty model reads. */
export interface PowerInput {
  weapons: Record<WeaponType, WeaponState>;
  doubleBullets: boolean;
  rapidFire: boolean;
  piercingBullets: boolean;
  bulletSizeBoost: number;
  speedBoost: number;
}

export interface HealthRange {
  min: number;
  max: number;
}

export interface BombParams {
  speed: number;
  explosionRadius: number;
  baseDamage: number;
  /** Fixed direction; diagonal/horizontal pick a random sign at launch. */
  dirX: number;
  dirY: number;
  randomSignX: boolean;
  bodyRadius: number;
  isLine: boolean;
  color: number;
  name: string;
}
