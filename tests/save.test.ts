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
});
