/**
 * Simulated weekly leaderboard for endless mode.
 *
 * Bot scores derive from the ISO-week seed and a fixed power-law curve only —
 * never from the player's own score (scaling rivals off the player would pin
 * their rank in place, and a rank that cannot move is not a leaderboard).
 * The board therefore resets naturally every Monday 00:00 UTC.
 */
import { hashString, mulberry32 } from '../core/prng';

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  isPlayer?: boolean;
}

export interface WeeklyBoard {
  weekKey: string;
  /** ms epoch of next Monday 00:00 UTC. */
  resetMs: number;
  /** All rows (bots + player), sorted desc, rank assigned from 1. */
  rows: LeaderboardRow[];
}

export const LEADERBOARD_BOTS = 100;
export const PLAYER_NAME = '你';

const BOT_NAMES: readonly string[] = [
  '星河', '小北', '阿圆', '青柠', '薄荷', '墨白', '栀子', '南栀', '北巷', '初雪',
  '晚风', '拾光', '鹿鸣', '听澜', '沐晴', '雨落', '云舒', '风眠', '星野', '月见',
  '苏苏', '七七', '阿狸', '团子', '布丁', '奶盖', '可乐', '雪碧', '桃桃', '芒果',
  '阿瓦隆', '夜航星', '追光者', '摸鱼人', '打工人', '肝帝', '咸鱼王', '躺平侠', '卷王', '欧皇',
  '非酋', '键盘侠', '手残党', '技术流', '意识流', '老六', '萌新酱', '大佬虎', '中单法王', '打野爸爸',
  '风一样', '雨中行', '云朵上', '山的彼端', '海的那边', '雾里花', '水中月', '镜中影', '梦里客', '醒时醉',
  '长安夜', '洛阳纸', '江南雨', '塞北雪', '大漠烟', '孤城闭', '春风度', '秋月明', '夏日炎', '冬雪寒',
  '一颗糖', '半杯茶', '三分甜', '十里香', '百叶窗', '千里目', '万里帆', '亿点点', '两不疑', '四时景',
  '电弧', '像素', '字节', '缓存', '断点', '递归', '指针', '堆栈', '线程', '协程',
  '量子猫', '薛定谔', '光年外', '引力波', '黑洞边', '虫洞口', '平行线', '折叠处', '奇点前', '弦振动',
];

/** ISO 8601 week key, e.g. 2026-W38 (UTC). */
export function isoWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Monday = 1 … Sunday = 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // Thursday of this week
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** ms epoch of the next reset: Monday 00:00 UTC after `now`. */
export function weekResetMs(now: Date = new Date()): number {
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayNum = new Date(utc).getUTCDay() || 7;
  return utc + (8 - dayNum) * 86_400_000;
}

/**
 * 100 bot scores for the week: power-law so most land in 50-400 and only a
 * handful reach four digits. Same week key -> same board, for everyone.
 */
export function simulateWeek(weekKey: string): LeaderboardRow[] {
  const rng = mulberry32(hashString(`hex-breaker:board:${weekKey}`));
  const rows: LeaderboardRow[] = [];
  const used = new Set<string>();
  for (let i = 0; i < LEADERBOARD_BOTS; i++) {
    let name = '';
    do {
      const base = BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)] ?? '玩家';
      name = `${base}${String(Math.floor(rng() * 10000)).padStart(4, '0')}`;
    } while (used.has(name));
    used.add(name);
    const u = rng();
    const score = Math.max(10, Math.floor(50 + Math.pow(u, 3.2) * 1450 + rng() * 30));
    rows.push({ rank: 0, name, score });
  }
  return rows;
}

/** Merge the player's endless high score into the week's simulated field. */
export function weeklyLeaderboard(playerBest: number, now: Date = new Date()): WeeklyBoard {
  const weekKey = isoWeekKey(now);
  const rows = simulateWeek(weekKey);
  rows.push({ rank: 0, name: PLAYER_NAME, score: Math.max(0, Math.floor(playerBest)), isPlayer: true });
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  return { weekKey, resetMs: weekResetMs(now), rows };
}
