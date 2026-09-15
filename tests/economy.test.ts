import { describe, expect, it } from 'vitest';
import { campaignCoinReward, COINS_DAILY, endlessCoinReward } from '../src/core/economy';

describe('coin reward rules', () => {
  it('campaign: first clear pays 30, replays pay 10', () => {
    expect(campaignCoinReward(true)).toBe(30);
    expect(campaignCoinReward(false)).toBe(10);
  });

  it('daily challenge pays a flat 20', () => {
    expect(COINS_DAILY).toBe(20);
  });

  it('endless: floor(score/10), capped at 50, never negative', () => {
    expect(endlessCoinReward(0)).toBe(0);
    expect(endlessCoinReward(9)).toBe(0);
    expect(endlessCoinReward(10)).toBe(1);
    expect(endlessCoinReward(135)).toBe(13);
    expect(endlessCoinReward(500)).toBe(50);
    expect(endlessCoinReward(9999)).toBe(50);
    expect(endlessCoinReward(-20)).toBe(0);
  });
});
