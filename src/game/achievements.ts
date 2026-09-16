import type Phaser from 'phaser';
import { achievementCoinReward, checkAchievements, type AchievementDef, type RunSummary } from '../core/achievements';
import { DESIGN_WIDTH } from './config/layout';
import { services } from './services';
import { showToast } from './ui/Toast';

/**
 * Evaluate achievements against the current save snapshot; newly unlocked
 * ones are persisted, their coin rewards paid out, and a toast + pickup
 * jingle shown. Safe to call from any scene after any stats-changing event
 * (run end, theme purchase, ...). Returns the freshly unlocked defs.
 */
export function runAchievementsCheck(scene: Phaser.Scene, run: RunSummary = {}): AchievementDef[] {
  const svc = services();
  const save = svc.save.get();
  const fresh = checkAchievements(save, save.achievements, run);
  if (fresh.length === 0) return fresh;
  svc.save.unlockAchievements(fresh.map((a) => a.id));
  const coins = achievementCoinReward(fresh);
  if (coins > 0) svc.save.addCoins(coins);
  showToast(scene, DESIGN_WIDTH / 2, 120, `🏆 解锁成就「${fresh.map((a) => a.name).join('」「')}」 +${coins} 金币`, 2600);
  svc.audio.pickup();
  return fresh;
}
