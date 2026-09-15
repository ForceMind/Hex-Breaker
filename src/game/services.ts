import { AudioService } from '../services/audio';
import { SaveService } from '../services/save';
import { VibrationService } from '../services/vibration';

/**
 * Process-wide singletons shared by every scene. Created once in main.ts.
 */
export interface Services {
  save: SaveService;
  audio: AudioService;
  vibration: VibrationService;
  applySettings(): void;
}

let instance: Services | null = null;

export function createServices(): Services {
  const save = new SaveService();
  const audio = new AudioService();
  const vibration = new VibrationService();
  const services: Services = {
    save,
    audio,
    vibration,
    applySettings: () => {
      const s = save.get().settings;
      audio.setSoundEnabled(s.sound);
      audio.setMusicEnabled(s.music);
      vibration.setEnabled(s.vibration);
    },
  };
  services.applySettings();
  instance = services;
  return services;
}

export function services(): Services {
  if (!instance) throw new Error('services not initialised');
  return instance;
}
