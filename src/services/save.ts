/**
 * localStorage persistence with a versioned schema and an in-memory fallback
 * when storage is unavailable (private mode, quota, non-browser tests).
 */
import { previousDateKey } from '../core/levels';

export const SAVE_KEY = 'hex-breaker:save';
export const SAVE_VERSION = 4;

export interface Settings {
  music: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface CampaignRecord {
  stars: number;
  bestTimeMs: number;
}

export interface CampaignProgress {
  /** Highest level the player may enter (1..30). */
  unlockedLevel: number;
  records: Record<number, CampaignRecord>;
}

export interface DailyProgress {
  /** UTC YYYY-MM-DD of the last daily run ('' when never played). */
  lastPlayedDate: string;
  streak: number;
  bestStars: number;
  bestTimeMs: number;
}

export interface Economy {
  coins: number;
  totalEarned: number;
}

export const DEFAULT_THEME = 'sky';

export interface SaveData {
  version: number;
  highScore: number;
  bestLevel: number;
  gamesPlayed: number;
  totalTilesDestroyed: number;
  settings: Settings;
  campaign: CampaignProgress;
  daily: DailyProgress;
  economy: Economy;
  selectedTheme: string;
  unlockedThemes: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    highScore: 0,
    bestLevel: 1,
    gamesPlayed: 0,
    totalTilesDestroyed: 0,
    settings: { music: true, sound: true, vibration: true },
    campaign: { unlockedLevel: 1, records: {} },
    daily: { lastPlayedDate: '', streak: 0, bestStars: 0, bestTimeMs: 0 },
    economy: { coins: 0, totalEarned: 0 },
    selectedTheme: DEFAULT_THEME,
    unlockedThemes: [DEFAULT_THEME],
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const int = (v: unknown, d: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;

/** Bring any stored payload (partial, legacy or corrupt) to the current schema. */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  d.highScore = int(raw.highScore, 0, 0);
  d.bestLevel = int(raw.bestLevel, 1, 1);
  d.gamesPlayed = int(raw.gamesPlayed, 0, 0);
  d.totalTilesDestroyed = int(raw.totalTilesDestroyed, 0, 0);
  if (isObj(raw.settings)) {
    d.settings.music = bool(raw.settings.music, true);
    d.settings.sound = bool(raw.settings.sound, true);
    d.settings.vibration = bool(raw.settings.vibration, true);
  }
  // v3 additions; absent in v1/v2 saves, in which case defaults are kept.
  if (isObj(raw.campaign)) {
    d.campaign.unlockedLevel = int(raw.campaign.unlockedLevel, 1, 1, 30);
    if (isObj(raw.campaign.records)) {
      for (const [key, value] of Object.entries(raw.campaign.records)) {
        const levelId = Number(key);
        if (!Number.isInteger(levelId) || levelId < 1 || levelId > 30 || !isObj(value)) continue;
        const stars = int(value.stars, 0, 0, 3);
        const bestTimeMs = int(value.bestTimeMs, 0, 0);
        if (stars > 0) d.campaign.records[levelId] = { stars, bestTimeMs };
      }
    }
  }
  if (isObj(raw.daily)) {
    d.daily.lastPlayedDate = typeof raw.daily.lastPlayedDate === 'string' ? raw.daily.lastPlayedDate : '';
    d.daily.streak = int(raw.daily.streak, 0, 0);
    d.daily.bestStars = int(raw.daily.bestStars, 0, 0, 3);
    d.daily.bestTimeMs = int(raw.daily.bestTimeMs, 0, 0);
  }
  // v4 additions; absent in v1-v3 saves, in which case defaults are kept.
  if (isObj(raw.economy)) {
    d.economy.coins = int(raw.economy.coins, 0, 0);
    d.economy.totalEarned = int(raw.economy.totalEarned, 0, 0);
  }
  if (Array.isArray(raw.unlockedThemes)) {
    d.unlockedThemes = [...new Set(raw.unlockedThemes.filter((t): t is string => typeof t === 'string'))];
  }
  if (!d.unlockedThemes.includes(DEFAULT_THEME)) d.unlockedThemes.unshift(DEFAULT_THEME);
  d.selectedTheme = typeof raw.selectedTheme === 'string' ? raw.selectedTheme : DEFAULT_THEME;
  if (!d.unlockedThemes.includes(d.selectedTheme)) d.selectedTheme = DEFAULT_THEME;
  d.version = SAVE_VERSION;
  return d;
}

export function isValidSave(data: SaveData): boolean {
  return (
    data.version === SAVE_VERSION &&
    Number.isInteger(data.highScore) &&
    data.highScore >= 0 &&
    isObj(data.settings) &&
    isObj(data.campaign) &&
    isObj(data.daily) &&
    isObj(data.economy) &&
    Array.isArray(data.unlockedThemes)
  );
}

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

interface StorageSelection {
  storage: StorageLike;
  persistent: boolean;
}

function pickStorage(): StorageSelection {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__hex_breaker_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return { storage: localStorage, persistent: true };
    }
  } catch {
    /* private mode or quota: fall back to memory */
  }
  return { storage: memoryStorage(), persistent: false };
}

export class SaveService {
  private data: SaveData;
  private readonly storage: StorageLike;
  private persistent: boolean;
  private readonly listeners = new Set<(data: SaveData) => void>();

  constructor(storage?: StorageLike) {
    const selected = storage ? { storage, persistent: true } : pickStorage();
    this.storage = selected.storage;
    this.persistent = selected.persistent;
    this.data = this.load();
  }

  get(): SaveData {
    return this.data;
  }

  isPersistent(): boolean {
    return this.persistent;
  }

  onChange(listener: (data: SaveData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): SaveData {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      return migrate(JSON.parse(raw));
    } catch {
      return defaultSave();
    }
  }

  save(): void {
    if (!isValidSave(this.data)) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      this.persistent = false;
    }
    for (const l of this.listeners) l(this.data);
  }

  update(mutator: (data: SaveData) => void): void {
    mutator(this.data);
    this.save();
  }

  reset(): void {
    this.data = defaultSave();
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    this.save();
  }

  /** Called when a run starts. */
  recordGameStart(): void {
    this.data.gamesPlayed += 1;
    this.save();
  }

  /**
   * Called when a run ends. Returns whether new records were set.
   */
  recordGameResult(score: number, level: number): { newHighScore: boolean; newBestLevel: boolean } {
    const newHighScore = score > this.data.highScore;
    const newBestLevel = level > this.data.bestLevel;
    if (newHighScore) this.data.highScore = score;
    if (newBestLevel) this.data.bestLevel = level;
    this.data.totalTilesDestroyed += Math.max(0, Math.round(score));
    this.save();
    return { newHighScore, newBestLevel };
  }

  /**
   * Campaign level cleared: keep only the better record (higher stars; on a
   * tie the faster time) and unlock the next level, capped at 30. Returns
   * whether the stored record improved.
   */
  recordCampaignResult(levelId: number, stars: number, timeMs: number): { improved: boolean } {
    const id = Math.max(1, Math.min(30, Math.round(levelId)));
    const s = Math.max(0, Math.min(3, Math.round(stars)));
    const t = Math.max(0, Math.round(timeMs));
    const prev = this.data.campaign.records[id];
    const improved = !prev || s > prev.stars || (s === prev.stars && t < prev.bestTimeMs);
    if (improved) this.data.campaign.records[id] = { stars: s, bestTimeMs: t };
    this.data.campaign.unlockedLevel = Math.min(30, Math.max(this.data.campaign.unlockedLevel, id + 1));
    this.save();
    return { improved };
  }

  /**
   * Daily challenge finished (win or lose). Streak: +1 when the previous run
   * was the UTC day before `dateKey`, unchanged on a same-day replay, reset
   * to 1 otherwise. Best record follows the stars-then-time rule. Returns
   * whether the daily best improved.
   */
  recordDailyResult(dateKey: string, stars: number, timeMs: number): { improved: boolean } {
    const d = this.data.daily;
    if (d.lastPlayedDate === previousDateKey(dateKey)) d.streak += 1;
    else if (d.lastPlayedDate !== dateKey) d.streak = 1;
    d.lastPlayedDate = dateKey;

    const s = Math.max(0, Math.min(3, Math.round(stars)));
    const t = Math.max(0, Math.round(timeMs));
    const improved = s > d.bestStars || (s === d.bestStars && (d.bestTimeMs === 0 || t < d.bestTimeMs));
    if (improved) {
      d.bestStars = s;
      d.bestTimeMs = t;
    }
    this.save();
    return { improved };
  }

  /** Grant coins (endless/campaign/daily rewards). */
  addCoins(amount: number): void {
    const a = Math.max(0, Math.round(amount));
    if (a === 0) return;
    this.data.economy.coins += a;
    this.data.economy.totalEarned += a;
    this.save();
  }

  /** Spend coins; returns false (and changes nothing) when the balance is short. */
  spendCoins(amount: number): boolean {
    const a = Math.max(0, Math.round(amount));
    if (this.data.economy.coins < a) return false;
    this.data.economy.coins -= a;
    this.save();
    return true;
  }

  /** Mark a theme as owned (idempotent). */
  unlockTheme(id: string): void {
    if (!this.data.unlockedThemes.includes(id)) {
      this.data.unlockedThemes.push(id);
      this.save();
    }
  }

  /** Switch the active theme; rejected (false) when the theme is not owned. */
  selectTheme(id: string): boolean {
    if (!this.data.unlockedThemes.includes(id)) return false;
    if (this.data.selectedTheme !== id) {
      this.data.selectedTheme = id;
      this.save();
    }
    return true;
  }
}
