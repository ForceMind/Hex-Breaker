import Phaser from 'phaser';
import './styles/global.css';
import { computeDesignHeight, DESIGN_WIDTH, devicePixelRatioCapped } from './game/config/layout';
import { BootScene } from './game/scenes/BootScene';
import { DailyScene } from './game/scenes/DailyScene';
import { GameScene } from './game/scenes/GameScene';
import { HelpScene } from './game/scenes/HelpScene';
import { HomeScene } from './game/scenes/HomeScene';
import { LeaderboardScene } from './game/scenes/LeaderboardScene';
import { LevelSelectScene } from './game/scenes/LevelSelectScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { ThemeScene } from './game/scenes/ThemeScene';
import { createServices } from './game/services';

const services = createServices();

const dpr = devicePixelRatioCapped();
const designHeight = computeDesignHeight(window.innerWidth, window.innerHeight);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1d33',
  width: DESIGN_WIDTH * dpr,
  height: designHeight * dpr,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  fps: { target: 60 },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3,
    touch: { capture: true },
  },
  // All sound is our own Web Audio synth (see AudioService); Phaser's sound
  // manager would only open a second AudioContext.
  audio: { noAudio: true },
  disableContextMenu: true,
  scene: [BootScene, HomeScene, HelpScene, SettingsScene, LevelSelectScene, DailyScene, ThemeScene, LeaderboardScene, GameScene],
});

game.registry.set('dpr', dpr);
game.registry.set('designHeight', designHeight);

// Audio may only start after a user gesture; iOS Safari only reliably grants
// AudioContext activation on gestures that also fire `click`, so every
// plausible gesture end-point is wired up here.
const unlockAudio = (): void => services.audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('pointerup', unlockAudio, { passive: true });
window.addEventListener('touchend', unlockAudio, { passive: true });
window.addEventListener('click', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio, { passive: true });

game.events.on(Phaser.Core.Events.HIDDEN, () => services.audio.suspend());
game.events.on(Phaser.Core.Events.VISIBLE, () => services.audio.resume());

// Block double-tap zoom on iOS Safari (touch-action alone is not enough there).
let lastTouch = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouch < 320) e.preventDefault();
    lastTouch = now;
  },
  { passive: false },
);
document.addEventListener('gesturestart', (e) => e.preventDefault());

window.addEventListener('error', (e) => {
  console.error('[hex-breaker] uncaught error', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[hex-breaker] unhandled rejection', e.reason);
});
