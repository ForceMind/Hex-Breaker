import { describe, expect, it } from 'vitest';
import { defaultSave, memoryStorage, migrate, SaveService, SAVE_KEY, SAVE_VERSION } from '../src/services/save';

describe('migrate', () => {
  it('returns defaults for non-objects', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('junk')).toEqual(defaultSave());
    expect(migrate(42)).toEqual(defaultSave());
  });

  it('returns defaults for an empty object', () => {
    expect(migrate({})).toEqual(defaultSave());
  });

  it('sanitizes partial/corrupt fields', () => {
    const d = migrate({ highScore: 120.7, bestLevel: 0, gamesPlayed: -5, settings: { music: false, sound: 'yes' } });
    expect(d.highScore).toBe(121);
    expect(d.bestLevel).toBe(1); // clamped to >= 1
    expect(d.gamesPlayed).toBe(0); // clamped to >= 0
    expect(d.settings.music).toBe(false);
    expect(d.settings.sound).toBe(true); // invalid -> default
    expect(d.settings.vibration).toBe(true);
    expect(d.version).toBe(SAVE_VERSION);
  });

  it('keeps valid values', () => {
    const d = migrate({ highScore: 88, bestLevel: 7, gamesPlayed: 3, totalTilesDestroyed: 500, settings: { music: false, sound: false, vibration: false } });
    expect(d.highScore).toBe(88);
    expect(d.bestLevel).toBe(7);
    expect(d.gamesPlayed).toBe(3);
    expect(d.totalTilesDestroyed).toBe(500);
    expect(d.settings).toEqual({ music: false, sound: false, vibration: false });
  });

  it('upgrades v1/v2 saves by filling campaign and daily defaults', () => {
    const v2 = {
      version: 2,
      highScore: 42,
      bestLevel: 5,
      gamesPlayed: 9,
      totalTilesDestroyed: 300,
      settings: { music: false, sound: true, vibration: true },
    };
    const d = migrate(v2);
    expect(d.version).toBe(SAVE_VERSION);
    expect(d.highScore).toBe(42);
    expect(d.campaign).toEqual({ unlockedLevel: 1, records: {} });
    expect(d.daily).toEqual({ lastPlayedDate: '', streak: 0, bestStars: 0, bestTimeMs: 0 });
  });

  it('upgrades v3 saves by filling economy and theme defaults', () => {
    const v3 = {
      version: 3,
      highScore: 42,
      campaign: { unlockedLevel: 6, records: { 5: { stars: 2, bestTimeMs: 40000 } } },
      daily: { lastPlayedDate: '2026-04-09', streak: 3, bestStars: 2, bestTimeMs: 70000 },
    };
    const d = migrate(v3);
    expect(d.version).toBe(SAVE_VERSION);
    expect(d.campaign.unlockedLevel).toBe(6);
    expect(d.campaign.records[5]).toEqual({ stars: 2, bestTimeMs: 40000 });
    expect(d.daily.streak).toBe(3);
    expect(d.economy).toEqual({ coins: 0, totalEarned: 0 });
    expect(d.selectedTheme).toBe('sky');
    expect(d.unlockedThemes).toEqual(['sky']);
  });

  it('sanitizes v4 theme fields: sky always owned, selection must be owned', () => {
    const d = migrate({
      economy: { coins: 120.6, totalEarned: 500 },
      selectedTheme: 'neon',
      unlockedThemes: ['forest', 'forest', 7, 'neon'],
    });
    expect(d.economy).toEqual({ coins: 121, totalEarned: 500 });
    expect(d.unlockedThemes).toEqual(['sky', 'forest', 'neon']);
    expect(d.selectedTheme).toBe('neon');
    const broken = migrate({ selectedTheme: 'neon', unlockedThemes: [] });
    expect(broken.unlockedThemes).toEqual(['sky']);
    expect(broken.selectedTheme).toBe('sky');
  });

  it('preserves valid campaign/daily payloads and sanitizes bad entries', () => {
    const d = migrate({
      campaign: {
        unlockedLevel: 99, // clamped to 30
        records: {
          3: { stars: 2, bestTimeMs: 61000 },
          7: { stars: 9, bestTimeMs: -5 }, // stars clamped to 3, time to 0
          31: { stars: 3, bestTimeMs: 1000 }, // out of range: dropped
          foo: { stars: 1, bestTimeMs: 1 }, // non-numeric key: dropped
          9: 'junk', // non-object: dropped
        },
      },
      daily: { lastPlayedDate: '2026-04-01', streak: 4.6, bestStars: 2, bestTimeMs: 90000 },
    });
    expect(d.campaign.unlockedLevel).toBe(30);
    expect(d.campaign.records).toEqual({ 3: { stars: 2, bestTimeMs: 61000 }, 7: { stars: 3, bestTimeMs: 0 } });
    expect(d.daily).toEqual({ lastPlayedDate: '2026-04-01', streak: 5, bestStars: 2, bestTimeMs: 90000 });
  });
});

describe('SaveService', () => {
  it('persists to the injected storage', () => {
    const storage = memoryStorage();
    const svc = new SaveService(storage);
    svc.recordGameStart();
    svc.recordGameResult(40, 6);
    const raw = storage.getItem(SAVE_KEY);
    expect(raw).toBeTruthy();

    const svc2 = new SaveService(storage);
    expect(svc2.get().highScore).toBe(40);
    expect(svc2.get().bestLevel).toBe(6);
    expect(svc2.get().gamesPlayed).toBe(1);
    expect(svc2.get().totalTilesDestroyed).toBe(40);
  });

  it('only better results overwrite records', () => {
    const svc = new SaveService(memoryStorage());
    svc.recordGameResult(40, 6);
    expect(svc.recordGameResult(20, 3)).toEqual({ newHighScore: false, newBestLevel: false });
    expect(svc.get().highScore).toBe(40);
    expect(svc.get().bestLevel).toBe(6);
    expect(svc.recordGameResult(55, 4)).toEqual({ newHighScore: true, newBestLevel: false });
    expect(svc.get().highScore).toBe(55);
    expect(svc.get().bestLevel).toBe(6);
  });

  it('accumulates total destroyed tiles across runs', () => {
    const svc = new SaveService(memoryStorage());
    svc.recordGameResult(10, 2);
    svc.recordGameResult(15, 3);
    expect(svc.get().totalTilesDestroyed).toBe(25);
  });

  it('recovers from corrupt JSON in storage', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    const svc = new SaveService(storage);
    expect(svc.get()).toEqual(defaultSave());
  });

  it('reset clears storage and restores defaults', () => {
    const storage = memoryStorage();
    const svc = new SaveService(storage);
    svc.recordGameResult(99, 9);
    svc.reset();
    expect(svc.get()).toEqual(defaultSave());
    const svc2 = new SaveService(storage);
    expect(svc2.get()).toEqual(defaultSave());
  });

  it('notifies listeners on change', () => {
    const svc = new SaveService(memoryStorage());
    let calls = 0;
    const off = svc.onChange(() => calls++);
    svc.recordGameStart();
    expect(calls).toBe(1);
    off();
    svc.recordGameStart();
    expect(calls).toBe(1);
  });

  describe('recordCampaignResult', () => {
    it('records a first clear and unlocks the next level', () => {
      const svc = new SaveService(memoryStorage());
      expect(svc.recordCampaignResult(3, 2, 60000)).toEqual({ improved: true });
      expect(svc.get().campaign.records[3]).toEqual({ stars: 2, bestTimeMs: 60000 });
      expect(svc.get().campaign.unlockedLevel).toBe(4);
    });

    it('only better results overwrite: higher stars, or same stars with faster time', () => {
      const svc = new SaveService(memoryStorage());
      svc.recordCampaignResult(5, 2, 60000);
      // Worse stars: ignored.
      expect(svc.recordCampaignResult(5, 1, 30000)).toEqual({ improved: false });
      expect(svc.get().campaign.records[5]).toEqual({ stars: 2, bestTimeMs: 60000 });
      // Same stars, slower: ignored.
      expect(svc.recordCampaignResult(5, 2, 90000)).toEqual({ improved: false });
      // Same stars, faster: kept.
      expect(svc.recordCampaignResult(5, 2, 45000)).toEqual({ improved: true });
      expect(svc.get().campaign.records[5]).toEqual({ stars: 2, bestTimeMs: 45000 });
      // More stars, slower: still kept (stars dominate).
      expect(svc.recordCampaignResult(5, 3, 99000)).toEqual({ improved: true });
      expect(svc.get().campaign.records[5]).toEqual({ stars: 3, bestTimeMs: 99000 });
    });

    it('is idempotent for identical replays', () => {
      const svc = new SaveService(memoryStorage());
      svc.recordCampaignResult(2, 3, 50000);
      expect(svc.recordCampaignResult(2, 3, 50000)).toEqual({ improved: false });
      expect(svc.get().campaign.records[2]).toEqual({ stars: 3, bestTimeMs: 50000 });
    });

    it('advances unlock monotonically and caps at 30', () => {
      const svc = new SaveService(memoryStorage());
      svc.recordCampaignResult(10, 1, 1000);
      expect(svc.get().campaign.unlockedLevel).toBe(11);
      // Replaying an earlier level never lowers the unlock.
      svc.recordCampaignResult(4, 3, 1000);
      expect(svc.get().campaign.unlockedLevel).toBe(11);
      svc.recordCampaignResult(30, 3, 1000);
      expect(svc.get().campaign.unlockedLevel).toBe(30);
    });

    it('persists across service instances', () => {
      const storage = memoryStorage();
      new SaveService(storage).recordCampaignResult(7, 2, 12345);
      const svc2 = new SaveService(storage);
      expect(svc2.get().campaign.records[7]).toEqual({ stars: 2, bestTimeMs: 12345 });
      expect(svc2.get().campaign.unlockedLevel).toBe(8);
    });
  });

  describe('recordDailyResult', () => {
    it('starts the streak at 1 on the first play', () => {
      const svc = new SaveService(memoryStorage());
      svc.recordDailyResult('2026-04-09', 2, 80000);
      expect(svc.get().daily).toEqual({ lastPlayedDate: '2026-04-09', streak: 1, bestStars: 2, bestTimeMs: 80000 });
    });

    it('increments the streak when the previous play was yesterday', () => {
      const svc = new SaveService(memoryStorage());
      svc.recordDailyResult('2026-04-08', 1, 90000);
      svc.recordDailyResult('2026-04-09', 2, 80000);
      expect(svc.get().daily.streak).toBe(2);
      // Across a month boundary too.
      svc.recordDailyResult('2026-05-01', 1, 70000);
      svc.recordDailyResult('2026-05-02', 1, 70000);
      expect(svc.get().daily.streak).toBe(2);
    });

    it('keeps the streak unchanged on a same-day replay', () => {
      const svc = new SaveService(memoryStorage());
      svc.recordDailyResult('2026-04-09', 1, 90000);
      svc.recordDailyResult('2026-04-09', 3, 60000);
      expect(svc.get().daily.streak).toBe(1);
      expect(svc.get().daily.bestStars).toBe(3);
      expect(svc.get().daily.bestTimeMs).toBe(60000);
    });

    it('resets the streak to 1 after a gap', () => {
      const svc = new SaveService(memoryStorage());
      svc.recordDailyResult('2026-04-01', 1, 90000);
      svc.recordDailyResult('2026-04-02', 1, 90000);
      expect(svc.get().daily.streak).toBe(2);
      svc.recordDailyResult('2026-04-05', 1, 90000);
      expect(svc.get().daily.streak).toBe(1);
    });

    it('tracks the best by stars first, then time; a zero-star loss still counts as played', () => {
      const svc = new SaveService(memoryStorage());
      expect(svc.recordDailyResult('2026-04-09', 0, 5000)).toEqual({ improved: true });
      expect(svc.get().daily.bestStars).toBe(0);
      expect(svc.recordDailyResult('2026-04-09', 0, 4000)).toEqual({ improved: true });
      expect(svc.recordDailyResult('2026-04-09', 0, 9999)).toEqual({ improved: false });
      expect(svc.recordDailyResult('2026-04-09', 1, 99999)).toEqual({ improved: true });
      expect(svc.get().daily.bestTimeMs).toBe(99999);
    });
  });

  describe('economy', () => {
    it('addCoins accumulates balance and lifetime earnings', () => {
      const svc = new SaveService(memoryStorage());
      svc.addCoins(30);
      svc.addCoins(10.6); // rounds to 11
      expect(svc.get().economy).toEqual({ coins: 41, totalEarned: 41 });
    });

    it('spendCoins deducts when affordable and rejects when short', () => {
      const svc = new SaveService(memoryStorage());
      svc.addCoins(100);
      expect(svc.spendCoins(60)).toBe(true);
      expect(svc.get().economy.coins).toBe(40);
      expect(svc.spendCoins(41)).toBe(false);
      expect(svc.get().economy.coins).toBe(40); // unchanged on rejection
      expect(svc.get().economy.totalEarned).toBe(100); // spending never reduces earnings
    });

    it('persists coins across service instances', () => {
      const storage = memoryStorage();
      const svc = new SaveService(storage);
      svc.addCoins(75);
      svc.spendCoins(25);
      expect(new SaveService(storage).get().economy.coins).toBe(50);
    });
  });

  describe('theme unlock state machine', () => {
    it('starts with only sky owned and selected', () => {
      const svc = new SaveService(memoryStorage());
      expect(svc.get().unlockedThemes).toEqual(['sky']);
      expect(svc.get().selectedTheme).toBe('sky');
    });

    it('rejects selecting a locked theme', () => {
      const svc = new SaveService(memoryStorage());
      expect(svc.selectTheme('neon')).toBe(false);
      expect(svc.get().selectedTheme).toBe('sky');
    });

    it('unlock -> select applies; unlock is idempotent', () => {
      const svc = new SaveService(memoryStorage());
      svc.unlockTheme('forest');
      svc.unlockTheme('forest');
      expect(svc.get().unlockedThemes).toEqual(['sky', 'forest']);
      expect(svc.selectTheme('forest')).toBe(true);
      expect(svc.get().selectedTheme).toBe('forest');
    });

    it('buy flow: spendCoins then unlockTheme then selectTheme', () => {
      const svc = new SaveService(memoryStorage());
      svc.addCoins(200);
      expect(svc.spendCoins(150)).toBe(true);
      svc.unlockTheme('sunset');
      expect(svc.selectTheme('sunset')).toBe(true);
      expect(svc.get().economy.coins).toBe(50);
      expect(svc.get().selectedTheme).toBe('sunset');
    });
  });
});
