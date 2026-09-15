/**
 * localStorage persistence with a versioned schema and an in-memory fallback
 * when storage is unavailable (private mode, quota, non-browser tests).
 */
export const SAVE_KEY = 'hex-breaker:save';
export const SAVE_VERSION = 1;

export interface Settings {
  music: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface SaveData {
  version: number;
  highScore: number;
  bestLevel: number;
  gamesPlayed: number;
  totalTilesDestroyed: number;
  settings: Settings;
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
  d.version = SAVE_VERSION;
  return d;
}

export function isValidSave(data: SaveData): boolean {
  return (
    data.version === SAVE_VERSION &&
    Number.isInteger(data.highScore) &&
    data.highScore >= 0 &&
    isObj(data.settings)
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
}
