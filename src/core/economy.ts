/** Coin reward rules for the coin economy, kept pure so they are testable. */
export const COINS_CAMPAIGN_FIRST = 30;
export const COINS_CAMPAIGN_REPEAT = 10;
export const COINS_DAILY = 20;
export const COINS_ENDLESS_CAP = 50;

/** First clear of a campaign level pays 30, replays pay 10. */
export function campaignCoinReward(firstClear: boolean): number {
  return firstClear ? COINS_CAMPAIGN_FIRST : COINS_CAMPAIGN_REPEAT;
}

/** Endless run payout: 1 coin per 10 destroyed tiles, capped at 50. */
export function endlessCoinReward(score: number): number {
  return Math.min(COINS_ENDLESS_CAP, Math.floor(Math.max(0, Math.floor(score)) / 10));
}
