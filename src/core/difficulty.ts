/** Dynamic difficulty model, ported 1:1 from the original demo. */
import type { HealthRange, PowerInput } from './types';

const WEAPON_POWER: Record<string, number> = {
  uzi: 1.2,
  shotgun: 1.5,
  laser: 1.8,
  spread: 1.3,
};

export function calculatePlayerPower(input: PowerInput): number {
  let power = 1;
  for (const [type, w] of Object.entries(input.weapons)) {
    if (!w.active) continue;
    const coeff = WEAPON_POWER[type];
    if (coeff !== undefined) power += w.level * coeff;
  }
  if (input.doubleBullets) power += 2;
  if (input.rapidFire) power += 1.5;
  if (input.piercingBullets) power += 1.3;
  if (input.bulletSizeBoost > 0) power += input.bulletSizeBoost * 0.3;
  if (input.speedBoost > 0) power += input.speedBoost * 0.2;

  const activeWeapons = Object.entries(input.weapons).filter(([t, w]) => w.active && t !== 'default').length;
  if (activeWeapons > 1) power += activeWeapons * 0.5;

  return Math.max(1, power);
}

export function calculateTileDensity(playerPower: number, level: number): number {
  const baseDensity = 0.62;
  const powerEffect = Math.min(playerPower / 12, 0.22);
  const levelEffect = Math.min(level / 24, 0.16);
  return Math.min(0.9, baseDensity + powerEffect + levelEffect);
}

export function calculateTileHealthRange(playerPower: number, level: number): HealthRange {
  const baseMin = Math.max(1, Math.floor(level / 3));
  const baseMax = Math.max(3, level + 2);
  const powerMultiplier = Math.max(0.8, playerPower / 9);
  const minHealth = Math.floor(baseMin * powerMultiplier);
  const maxHealth = Math.floor(baseMax * powerMultiplier);
  // Once the cap bites, minHealth can exceed the capped max: clamp min down so
  // the range never inverts.
  const max = Math.min(40, Math.max(minHealth + 1, maxHealth));
  return {
    min: Math.min(Math.max(1, minHealth), max),
    max,
  };
}

/** Downward tile speed per frame. */
export function tileFallSpeed(gameSpeed: number, playerPower: number): number {
  const speedMultiplier = Math.min(1.4, 1 + (playerPower - 1) / 15);
  return gameSpeed * 0.42 * speedMultiplier;
}

export type DifficultyLabel = '简单' | '稍难' | '中等' | '困难' | '地狱';

export function difficultyLabel(playerPower: number): DifficultyLabel {
  if (playerPower >= 15) return '地狱';
  if (playerPower >= 12) return '困难';
  if (playerPower >= 8) return '中等';
  if (playerPower >= 5) return '稍难';
  return '简单';
}
