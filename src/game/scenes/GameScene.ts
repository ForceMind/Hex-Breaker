import Phaser from 'phaser';
import {
  BOOMERANG,
  BOMB_MIN_DAMAGE,
  BOMB_PARAMS,
  BULLET_COLORS,
  BULLET_RADIUS,
  BULLET_SPEED,
  dropChance,
  FIRST_ROW_Y,
  FULL_ROW_NAME,
  GLOBAL_SHOT_COOLDOWN,
  INITIAL_HEALTH_MAX,
  INITIAL_ROWS,
  INVINCIBLE_FRAMES,
  ITEM_DROP_SIZE,
  ITEM_DROP_SPEED,
  ITEM_META,
  LASER_SPEED,
  LINE_BOMB_HALF_WIDTH,
  MAGNET_FORCE,
  MAX_BULLET_SIZE_BOOST,
  MAX_LIVES,
  PATTERN_NAMES,
  PIERCING_MAX_HITS,
  PLAYER_BOTTOM_MARGIN,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  SCORE_PER_LEVEL,
  SHAPED_ROW_CHANCE,
  SHAPED_ROW_MIN_LEVEL,
  SHIELD_FRAMES,
  SPEED_BOOST_STEP,
  SPEED_PER_LEVEL,
  START_LIVES,
  STRONG_SHIELD_FRAMES,
  TILE_SIZE,
  TILE_SPACING,
  WEAPON_BAR_COLORS,
  WEAPON_MAX_LEVEL,
  availableItems,
  weaponCooldown,
  weaponDuration,
} from '../../core/config';
import { type AchievementDef, type RunSummary } from '../../core/achievements';
import { runAchievementsCheck } from '../achievements';
import { calculatePlayerPower, calculateTileDensity, calculateTileHealthRange, difficultyLabel, tileFallSpeed } from '../../core/difficulty';
import { campaignCoinReward, COINS_DAILY, endlessCoinReward } from '../../core/economy';
import { formatTimeMs } from '../../core/format';
import type { LevelDef } from '../../core/levels';
import { getCampaignLevel, levelActIndexAt, levelPatternAt } from '../../core/levels';
import { itemName } from '../../core/itemNames';
import {
  applyPerk,
  PERK_PICK_FRAMES,
  PERKS,
  rollPerkChoices,
  type PerkDef,
  type PerkId,
  type PerkState,
} from '../../core/perks';
import { generatePattern, pickPattern } from '../../core/patterns';
import { mulberry32 } from '../../core/prng';
import type { BombType, BulletKind, ItemType, SpecialWeaponType, WeaponState, WeaponType } from '../../core/types';
import { SPECIAL_WEAPONS } from '../../core/types';
import { css, DEPTH, FONT_FAMILY } from '../config/layout';
import { activeThemeId, playerSpriteKey, resolvePlayerSprite, resolveThemeTile, themeColors, type ThemeColors } from '../config/themes';
import { TEX, itemGlyph, tileTexture } from '../rendering/textures';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { showToast } from '../ui/Toast';
import { BaseScene } from './BaseScene';
import { ASSET_TEX_FAILED_KEY } from '../config/assets';

interface TileRec {
  id: number;
  cx: number;
  cy: number;
  health: number;
  maxHealth: number;
  active: boolean;
  view: Phaser.GameObjects.Container;
  /** Procedural thickness stack (kept under the AI face as the dark body). */
  img: Phaser.GameObjects.Image;
  /** AI tile art overlay; null in full-procedural mode. */
  face: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
}

interface BulletRec {
  x: number;
  y: number;
  kind: BulletKind;
  angleOffset: number;
  speed: number;
  radius: number;
  piercing: boolean;
  hitCount: number;
  maxHits: number;
  damage: number;
  active: boolean;
  view: Phaser.GameObjects.Image;
}

interface ItemRec {
  x: number;
  y: number;
  type: ItemType;
  active: boolean;
  view: Phaser.GameObjects.Container;
}

interface BombRec {
  x: number;
  y: number;
  type: BombType;
  dirX: number;
  dirY: number;
  active: boolean;
  view: Phaser.GameObjects.Container;
}

type BoomerangMode = 'arc' | 'straight' | 'returning';

interface BoomerangRec {
  startX: number;
  startY: number;
  x: number;
  y: number;
  time: number;
  mode: BoomerangMode;
  canBeCaught: boolean;
  hitTiles: Set<number>;
  killedThisFrame: boolean;
  dirX: number;
  dirY: number;
  active: boolean;
  view: Phaser.GameObjects.Image;
}

interface HudCache {
  score: number;
  chip: string;
  lives: number;
  info: string;
}

interface BossRec {
  hp: number;
  maxHp: number;
  baseScale: number;
  view: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
}

/** Boss visuals/behaviour constants (boss levels 10/20/30). */
const BOSS_Y = 215;
const BOSS_HALF = 75; // 3x a 50px tile
const BOSS_TINT = 0xe05252;
const BOSS_DRIFT_X = 40;
const ESCORT_WAVE_FRAMES = 240; // ~4 s at 60 fps

/** Scene-start payload: endless (default), campaign level, or daily challenge. */
export type GameSceneData = { mode: 'endless' } | { mode: 'level'; level: LevelDef } | { mode: 'daily'; level: LevelDef; dateKey: string };

/**
 * Endless mode: octagon tiles stream down from the top; the player dodges and
 * shoots them. One Phaser frame = one logic frame, so every frame-based
 * constant from the original demo carries over unchanged.
 *
 * Level/daily modes reuse the same sandbox with three changes: randomness is
 * seeded (LevelDef.seed), the difficulty formulas anchor on
 * LevelDef.virtualLevel instead of the in-run level, and the run ends in
 * victory once LevelDef.targetKills tiles are destroyed.
 *
 * Juice inventory (Arrow Flow recipe): per-tile soft shadow + glaze, pop-in
 * stagger per column, hit pulse + white flash, shatter + diamond sparks +
 * shock ring on destroy, red vignette + shake on life loss, popText for
 * level-ups and pickups, tweened bomb shockwaves (no per-frame Graphics
 * outside the HUD bars), player tilt + faint trail, floating item boxes.
 */
export class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  // --- mode ------------------------------------------------------------------
  /** Palette snapshot taken in init(); scenes re-read it on every create. */
  private COLORS: ThemeColors = themeColors();
  /** Active skin at scene start; drives item names and tile art. */
  private themeId = 'sky';
  /** AI tile-face texture for the active theme; null = procedural tiles. */
  private tileArtKey: string | null = null;
  private mode: GameSceneData['mode'] = 'endless';
  private levelDef: LevelDef | null = null;
  private dateKey = '';
  private runData: GameSceneData = { mode: 'endless' };
  private victoryStarted = false;
  private livesLost = 0;
  private elapsedFrames = 0;
  /** Daily coin reward is earned on today's first clear; a loss doesn't consume it. */
  private dailyRewardPending = false;

  // --- run state -------------------------------------------------------------
  private playing = false;
  private paused = false;
  private finalized = false;
  private score = 0;
  private level = 1;
  private gameSpeed = 1;
  private lives = START_LIVES;
  private currentPattern: string = FULL_ROW_NAME;
  /** Scripted campaign row/act cursors; reset because scenes are reused. */
  private scriptedRowIndex = 0;
  private scriptedActIndex = -1;
  /** Run randomness; seeded in level/daily modes, plain Math.random in endless. */
  private rng: () => number = Math.random;

  // --- player state ----------------------------------------------------------
  private px = 0; // left edge
  private py = 0; // top edge
  private weapons!: Record<WeaponType, WeaponState>;
  private globalCooldown = 0;
  private shield = false;
  private shieldDuration = 0;
  private doubleBullets = false;
  private speedBoost = 0;
  private rapidFire = false;
  private piercingBullets = false;
  private pierceBoost = 0;
  private fireRateBoost = 1;
  private shieldBooster = false;
  private magneticRange = 0;
  private bulletSizeBoost = 0;
  private weaponDurationBoost = 1;

  // --- entities --------------------------------------------------------------
  private tiles: TileRec[] = [];
  private bullets: BulletRec[] = [];
  private items: ItemRec[] = [];
  private bombs: BombRec[] = [];
  private boomerangs: BoomerangRec[] = [];
  private boss: BossRec | null = null;
  private nextTileId = 1;

  // --- views -----------------------------------------------------------------
  private playerView!: Phaser.GameObjects.Container;
  private shieldRing!: Phaser.GameObjects.Image;
  private tiltTween: Phaser.Tweens.Tween | null = null;
  private trailFrame = 0;
  private hearts: Phaser.GameObjects.Image[] = [];
  private scoreChipG!: Phaser.GameObjects.Graphics;
  private scoreChipT!: Phaser.GameObjects.Text;
  private levelChipG!: Phaser.GameObjects.Graphics;
  private levelChipT!: Phaser.GameObjects.Text;
  private hudInfo!: Phaser.GameObjects.Text;
  private hudCache: HudCache = { score: -1, chip: '', lives: -1, info: '' };
  private barGfx!: Phaser.GameObjects.Graphics;
  private barLabels: Phaser.GameObjects.Text[] = [];
  private barTimes: Phaser.GameObjects.Text[] = [];
  private targetGfx: Phaser.GameObjects.Graphics | null = null;
  private targetText: Phaser.GameObjects.Text | null = null;
  private vignette!: Phaser.GameObjects.Image;
  private pauseLayer: Phaser.GameObjects.Container | null = null;
  private overLayer: Phaser.GameObjects.Container | null = null;
  /** Level-up perk pick overlay; while non-null the run is frozen. */
  private perkLayer: Phaser.GameObjects.Container | null = null;
  private perkChoices: PerkDef[] = [];
  private perkCountdown = 0;
  private perkBar: Phaser.GameObjects.Graphics | null = null;
  private perkBarW = 0;
  private perkBarX = 0;
  private perkBarY = 0;
  private shatter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trailFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastShakeAt = 0;

  // --- input -------------------------------------------------------------------
  private keys = { left: false, right: false };
  private pointerWorldX: number | null = null;

  private readonly tilesPerRow = Math.floor(540 / TILE_SPACING);

  override init(data?: GameSceneData): void {
    super.init(data);
    this.COLORS = themeColors();
    this.themeId = activeThemeId();
    const d: GameSceneData = data ?? { mode: 'endless' };
    this.runData = d;
    this.mode = d.mode;
    this.levelDef = d.mode === 'endless' ? null : d.level;
    this.dateKey = d.mode === 'daily' ? d.dateKey : '';
    this.dailyRewardPending = d.mode === 'daily' && this.svc.save.get().daily.lastPlayedDate !== d.dateKey;
  }

  create(): void {
    this.addBackground();
    this.fadeIn();

    this.svc.save.recordGameStart();
    this.resetRun();
    this.buildViews();
    this.bindInput();
    if (this.levelDef?.boss) this.spawnBoss(this.levelDef.boss.hp);
    else this.spawnInitialRows();
    this.playing = true;
  }

  // ============================================================================
  // setup
  // ============================================================================

  private resetRun(): void {
    this.score = 0;
    this.level = 1;
    this.gameSpeed = 1;
    this.lives = START_LIVES;
    this.currentPattern = FULL_ROW_NAME;
    this.scriptedRowIndex = 0;
    this.scriptedActIndex = -1;
    this.finalized = false;
    this.playing = false;
    this.paused = false;
    this.tiltTween = null;
    this.trailFrame = 0;
    this.victoryStarted = false;
    this.livesLost = 0;
    this.elapsedFrames = 0;
    // Seeded runs make a level/daily play out identically for every player.
    this.rng = this.levelDef ? mulberry32(this.levelDef.seed) : Math.random;

    this.px = this.W / 2 - PLAYER_WIDTH / 2;
    this.py = this.H - PLAYER_BOTTOM_MARGIN - PLAYER_HEIGHT;
    this.weapons = {
      default: { active: true, level: 1, duration: 0, maxDuration: 0, cooldown: 0 },
      uzi: { active: false, level: 1, duration: 0, maxDuration: 0, cooldown: 0 },
      shotgun: { active: false, level: 1, duration: 0, maxDuration: 0, cooldown: 0 },
      laser: { active: false, level: 1, duration: 0, maxDuration: 0, cooldown: 0 },
      spread: { active: false, level: 1, duration: 0, maxDuration: 0, cooldown: 0 },
    };
    this.globalCooldown = 0;
    this.shield = false;
    this.shieldDuration = 0;
    this.doubleBullets = false;
    this.speedBoost = 0;
    this.rapidFire = false;
    this.piercingBullets = false;
    this.pierceBoost = 0;
    this.fireRateBoost = 1;
    this.shieldBooster = false;
    this.magneticRange = 0;
    this.bulletSizeBoost = 0;
    this.weaponDurationBoost = 1;

    this.tiles = [];
    this.bullets = [];
    this.items = [];
    this.bombs = [];
    this.boomerangs = [];
    this.boss = null;
    this.nextTileId = 1;
    // HUD weapon-bar texts are re-created in create(); the scene instance is
    // reused across restarts, so drop the previous run's (destroyed) refs —
    // calling setText on a destroyed Text crashes Phaser (null frame data).
    this.barLabels = [];
    this.barTimes = [];
    // No pick overlay survives a restart: the previous run's layer was
    // destroyed with the scene display list.
    this.perkLayer = null;
    this.perkChoices = [];
    this.perkCountdown = 0;
    this.perkBar = null;
  }

  private buildViews(): void {
    // player: the active theme's sprite art when available; falls back along
    // theme -> sky sprite -> procedural block (see resolvePlayerSprite).
    const playerCenterX = this.px + PLAYER_WIDTH / 2;
    const playerCenterY = this.py + PLAYER_HEIGHT / 2;
    this.playerView = this.add.container(playerCenterX, playerCenterY).setDepth(DEPTH.player);
    const glow = this.add.image(0, 0, TEX.softCircle).setTint(0xffdd00).setAlpha(0.5).setScale(0.5);
    const failed = new Set((this.registry.get(ASSET_TEX_FAILED_KEY) as string[] | undefined) ?? []);
    const artAvailable = (key: string): boolean => this.textures.exists(key) && !failed.has(key);
    this.tileArtKey = resolveThemeTile(this.themeId, artAvailable);
    const spriteKey = resolvePlayerSprite(this.themeId, artAvailable);
    const spriteSize = spriteKey === playerSpriteKey('space') ? 60 : 56; // the ship art reads better slightly larger
    const body = spriteKey
      ? this.add.image(0, 0, spriteKey).setDisplaySize(spriteSize, spriteSize)
      : this.add.image(0, 0, TEX.player).setTint(0xffdd00).setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);
    this.shieldRing = this.add.image(0, 0, TEX.shieldRing).setTint(0x00e5e5).setScale(0.5).setVisible(false);
    this.playerView.add([glow, body, this.shieldRing]);

    // Scene-level particle emitters, created once and reused (Phaser pools the
    // particles internally): tile shatter, diamond sparks, player trail, and
    // confetti for a new record on the game-over panel.
    this.shatter = this.add.particles(0, 0, TEX.particle, {
      speed: { min: 40, max: 160 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 420,
      gravityY: 220,
      tint: [this.COLORS.tile, 0xffffff, this.COLORS.tileStroke],
      emitting: false,
    });
    this.shatter.setDepth(DEPTH.effects);

    this.sparks = this.add.particles(0, 0, TEX.spark, {
      speed: { min: 120, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 300, max: 600 },
      gravityY: 200,
      tint: [0xffffff, this.COLORS.tile, this.COLORS.accent, 0xffd166],
      emitting: false,
    });
    this.sparks.setDepth(DEPTH.effects);

    this.trailFx = this.add.particles(0, 0, TEX.particle, {
      speed: { min: 5, max: 30 },
      scale: { start: 0.32, end: 0 },
      alpha: { start: 0.55, end: 0 },
      lifespan: 220,
      tint: [0xffdd00, 0xffffff],
      emitting: false,
    });
    this.trailFx.setDepth(DEPTH.player - 1);

    this.confettiFx = this.add.particles(0, 0, TEX.particle, {
      x: { min: 0, max: this.W },
      y: -20,
      speedY: { min: 120, max: 260 },
      speedX: { min: -60, max: 60 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 1, end: 0.2 },
      rotate: { min: 0, max: 360 },
      lifespan: 2400,
      gravityY: 120,
      tint: [this.COLORS.accent, this.COLORS.tile, 0xffb703, 0xff6699, 0xffffff],
      frequency: 30,
      emitting: false,
    });
    this.confettiFx.setDepth(DEPTH.modal + 1);

    // Full-screen damage vignette, flashed on life loss.
    this.vignette = this.add
      .image(this.W / 2, this.H / 2, TEX.vignette)
      .setDisplaySize(this.W, this.H)
      .setAlpha(0)
      .setDepth(DEPTH.effects + 1);

    // HUD backdrop band: same gradient as the background so tiles sliding in
    // from the top pass underneath it instead of overlapping the HUD text.
    const bandH = 118;
    const band = this.add.graphics().setDepth(DEPTH.hud - 1);
    const bandTop = Phaser.Display.Color.ValueToColor(this.COLORS.bgTop);
    const bandBottom = Phaser.Display.Color.ValueToColor(this.COLORS.bgBottom);
    for (let i = 0; i < bandH; i += 4) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(bandTop, bandBottom, this.H, i);
      band.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      band.fillRect(0, i, this.W, 4);
    }
    band.fillStyle(this.COLORS.textPrimary, 0.08);
    band.fillRect(0, bandH - 2, this.W, 2);

    // HUD: capsule chips for score / level, merged info line below them.
    const hudDepth = DEPTH.hud;
    this.scoreChipG = this.add.graphics().setDepth(hudDepth);
    this.scoreChipT = this.text(30, 30, '', { size: 18, bold: true, align: 'left' }).setDepth(hudDepth);
    this.levelChipG = this.add.graphics().setDepth(hudDepth);
    this.levelChipT = this.text(28, 66, '', { size: 14, bold: true, align: 'left' }).setDepth(hudDepth);
    this.hudInfo = this.text(20, 100, '', { size: 12, color: this.COLORS.textSecondary, align: 'left' }).setDepth(hudDepth);

    new Button(this, this.W - 34, 32, {
      label: '❚❚',
      variant: 'ghost',
      width: 52,
      height: 44,
      fontSize: 16,
      onClick: () => this.togglePause(),
    }).setDepth(hudDepth);

    this.barGfx = this.add.graphics().setDepth(hudDepth);
    // Level/daily modes: a slim target-progress bar just under the HUD band.
    if (this.levelDef) {
      this.targetGfx = this.add.graphics().setDepth(hudDepth);
      this.targetText = this.text(this.W / 2, 143, '', { size: 12, bold: true, color: this.COLORS.textSecondary }).setDepth(hudDepth);
    }
    for (let i = 0; i < 4; i++) {
      const label = this.text(0, 0, '', { size: 12, bold: true, align: 'left' }).setDepth(hudDepth).setVisible(false);
      label.setStroke('#ffffff', 2);
      const time = this.text(0, 0, '', { size: 10, color: this.COLORS.textSecondary, align: 'right' }).setDepth(hudDepth).setVisible(false);
      time.setStroke('#ffffff', 2);
      this.barLabels.push(label);
      this.barTimes.push(time);
    }

    this.refreshHearts();
    this.refreshHud(true);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => (this.keys.left = true));
    kb?.on('keyup-LEFT', () => (this.keys.left = false));
    kb?.on('keydown-RIGHT', () => (this.keys.right = true));
    kb?.on('keyup-RIGHT', () => (this.keys.right = false));
    kb?.on('keydown-P', () => this.togglePause());
    kb?.on('keydown-ESC', () => this.exitToHome());
    kb?.on('keydown-SPACE', () => {
      if (!this.playing && this.overLayer) this.refresh(this.runData);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerWorldX = this.toWorldX(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.pointerWorldX = this.toWorldX(p);
    });
    this.input.on('pointerup', () => (this.pointerWorldX = null));
  }

  private toWorldX(p: Phaser.Input.Pointer): number {
    const pt = this.cameras.main.getWorldPoint(p.x, p.y);
    return pt.x;
  }

  // ============================================================================
  // effects helpers
  // ============================================================================

  /** Floating text that pops in, holds, then drifts up and fades. */
  private popText(x: number, y: number, message: string, size = 26, color: number = this.COLORS.accent): void {
    const t = this.add.text(x, y, message, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: css(color),
      stroke: '#ffffff',
      strokeThickness: 4,
      resolution: this.dpr,
    });
    t.setOrigin(0.5).setDepth(DEPTH.effects).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: t, scaleX: 1, scaleY: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 420, duration: 360, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  /** Expanding shock ring, self-destroying. */
  private shockwave(x: number, y: number, endScale: number, duration = 220, tint = 0xffffff): void {
    const ring = this.add.image(x, y, TEX.ring).setTint(tint).setAlpha(0.7).setScale(0.2).setDepth(DEPTH.effects);
    this.tweens.add({ targets: ring, scaleX: endScale, scaleY: endScale, alpha: 0, duration, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  /** Red edge flash + camera kick when a life is lost. */
  private flashVignette(): void {
    this.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(0);
    this.tweens.add({ targets: this.vignette, alpha: 0.3, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  // ============================================================================
  // tile rows
  // ============================================================================

  private spawnInitialRows(): void {
    // Campaign levels start inside their first scripted act instead of every
    // run opening with the same three full rows. Endless/daily stay unchanged.
    if (this.levelDef?.script?.length) {
      for (let row = 0; row < INITIAL_ROWS; row++) {
        this.spawnRowAt(row * TILE_SPACING + FIRST_ROW_Y, (INITIAL_ROWS - 1 - row) * 70, true);
      }
      this.showScriptActCue(0, true);
      return;
    }
    for (let row = 0; row < INITIAL_ROWS; row++) {
      const y = row * TILE_SPACING + FIRST_ROW_Y;
      const startCenterX = (this.W - (this.tilesPerRow - 1) * TILE_SPACING) / 2;
      for (let col = 0; col < this.tilesPerRow; col++) {
        const health = Math.floor(this.rng() * INITIAL_HEALTH_MAX) + 1;
        // Bottom rows pop first, columns cascade left to right.
        this.spawnTile(startCenterX + col * TILE_SPACING, y + TILE_SIZE / 2, health, (INITIAL_ROWS - 1 - row) * 70 + col * 20);
      }
    }
  }

  /** Row generation driven by the topmost tile position, as in the original. */
  private maintainRows(): void {
    if (this.victoryStarted) return; // board is being cleared for the finale
    if (this.levelDef?.boss) return; // boss levels spawn escort waves instead
    let topMostY = this.H;
    let hasActive = false;
    for (const t of this.tiles) {
      if (!t.active) continue;
      hasActive = true;
      const top = t.cy - TILE_SIZE / 2;
      if (top < topMostY) topMostY = top;
    }
    if (!hasActive || topMostY > 0) {
      const newTop = !hasActive ? FIRST_ROW_Y : topMostY - TILE_SPACING;
      this.spawnRowAt(newTop);
    }
  }

  /** Show a compact act cue and remember it so every threshold fires once. */
  private showScriptActCue(actIndex: number, opening = false): void {
    const act = this.levelDef?.script?.[actIndex];
    if (!act || actIndex === this.scriptedActIndex) return;
    this.scriptedActIndex = actIndex;
    const label = opening ? `第 1 幕 · ${act.name}` : `第 ${actIndex + 1} 幕 · ${act.name}`;
    this.popText(this.W / 2, 190, label, 22, this.COLORS.accent);
  }

  /** Advance the campaign choreography when the kill threshold is crossed. */
  private updateScriptAct(): void {
    if (!this.levelDef?.script?.length) return;
    const actIndex = levelActIndexAt(this.levelDef, this.score);
    if (actIndex !== this.scriptedActIndex) {
      // Start the new sequence from its first silhouette.
      this.scriptedRowIndex = 0;
      this.showScriptActCue(actIndex);
    }
  }

  /** The level argument fed into the difficulty formulas for this run. */
  private difficultyLevel(): number {
    return this.levelDef ? this.levelDef.virtualLevel : this.level;
  }

  private spawnRowAt(yTop: number, basePopDelay = 0, useInitialHealth = false): void {
    const dl = this.difficultyLevel();
    const scriptedPattern = this.levelDef ? levelPatternAt(this.levelDef, this.score, this.scriptedRowIndex) : null;
    if (scriptedPattern) this.scriptedRowIndex += 1;
    const useShaped = scriptedPattern !== null || (dl >= SHAPED_ROW_MIN_LEVEL && this.rng() < SHAPED_ROW_CHANCE);
    const power = this.playerPower();
    const healthRange = calculateTileHealthRange(power, dl);
    const rollHealth = (): number =>
      useInitialHealth
        ? Math.floor(this.rng() * INITIAL_HEALTH_MAX) + 1
        : Math.floor(this.rng() * (healthRange.max - healthRange.min + 1)) + healthRange.min;

    if (useShaped) {
      const pattern = scriptedPattern ?? pickPattern(this.rng);
      this.currentPattern = PATTERN_NAMES[pattern];
      const mask = generatePattern(pattern, this.tilesPerRow, this.rng);
      const startCenterX = (this.W - (this.tilesPerRow - 1) * TILE_SPACING) / 2;
      for (let col = 0; col < this.tilesPerRow; col++) {
        if (!mask[col]) continue;
        this.spawnTile(startCenterX + col * TILE_SPACING, yTop + TILE_SIZE / 2, rollHealth(), basePopDelay + col * 20);
      }
    } else {
      this.currentPattern = FULL_ROW_NAME;
      const density = calculateTileDensity(power, dl);
      const count = Math.floor(this.tilesPerRow * density);
      const startCenterX = (this.W - (count - 1) * TILE_SPACING) / 2;
      for (let col = 0; col < count; col++) {
        this.spawnTile(startCenterX + col * TILE_SPACING, yTop + TILE_SIZE / 2, rollHealth(), basePopDelay + col * 20);
      }
    }
  }

  private spawnTile(cx: number, cy: number, health: number, popDelay = 0): void {
    // soft shadow under the tile -> the stack reads as floating
    const shadow = this.add.image(0, 5, TEX.softCircle).setTint(0x9dbad8).setAlpha(0.18).setScale((TILE_SIZE + 10) / 256);
    const img = this.add.image(0, 0, tileTexture(health)).setTint(this.tileStackTint());
    img.setDisplaySize(TILE_SIZE + 8, TILE_SIZE + 8);
    // AI face on top of the dark stack, or the baked glaze flake in
    // procedural mode (white, not tinted)
    const face = this.tileArtKey ? this.add.image(0, 0, this.tileArtKey).setDisplaySize(TILE_SIZE, TILE_SIZE) : null;
    const glaze = face ? null : this.add.image(0, 0, TEX.tileHighlight).setDisplaySize(TILE_SIZE + 8, TILE_SIZE + 8);
    const label = this.add
      .text(0, 0, String(health), {
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#17364f',
        resolution: this.dpr,
      })
      .setOrigin(0.5);
    const view = this.add.container(cx, cy, [shadow, img, ...(face ? [face] : glaze ? [glaze] : []), label]).setDepth(DEPTH.tiles);
    // entrance pop: 0.6 -> 1, staggered per column by the caller
    view.setScale(0.6);
    this.tweens.add({ targets: view, scaleX: 1, scaleY: 1, duration: 150, delay: popDelay, ease: 'Quad.easeOut' });
    this.tiles.push({
      id: this.nextTileId++,
      cx,
      cy,
      health,
      maxHealth: health,
      active: true,
      view,
      img,
      face,
      label,
    });
    this.updateTileView(this.tiles[this.tiles.length - 1] as TileRec);
  }

  /** Stack tint: dark stroke under AI art, the theme tile colour otherwise. */
  private tileStackTint(): number {
    return this.tileArtKey ? this.COLORS.tileStroke : this.COLORS.tile;
  }

  private updateTileView(t: TileRec): void {
    const thickness = Math.min(Math.max(t.health, 1), 8);
    t.img.setTexture(tileTexture(thickness));
    const layerDepth = (thickness - 1) * 3;
    // The number sits on the top layer, which steps up-left.
    t.label.setPosition(-layerDepth * 0.3, -layerDepth * 0.3);
    if (t.health <= 0) return;
    t.label.setText(String(t.health));
    const ratio = t.health / t.maxHealth;
    t.label.setColor(ratio > 0.7 ? '#17364f' : ratio > 0.3 ? '#ff6600' : '#ff0000');
  }

  /** Damage a tile; returns true when the tile was destroyed. */
  private damageTile(t: TileRec, amount: number): boolean {
    // Once victory begins, the timed clear sequence owns every remaining tile.
    // Residual bullets/bombs must not score, level up, or reopen a perk picker.
    if (!t.active || this.victoryStarted) return false;
    t.health -= amount;
    if (t.health > 0) {
      this.updateTileView(t);
      // hit pulse: 1 -> 1.06 -> 1 (killing any in-flight pop tween first)
      this.tweens.killTweensOf(t.view);
      t.view.setScale(1);
      this.tweens.add({ targets: t.view, scaleX: 1.06, scaleY: 1.06, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
      // brief flash on the face: AI art can't take setTintFill, so it
      // flickers alpha; procedural tiles flash white as before
      if (t.face) {
        t.face.setAlpha(0.4);
        this.time.delayedCall(80, () => {
          if (t.face?.scene) t.face.setAlpha(1);
        });
      } else {
        t.img.setTintFill(0xffffff);
        this.time.delayedCall(80, () => {
          if (t.img.scene) t.img.setTint(this.tileStackTint());
        });
      }
      return false;
    }
    t.active = false;
    t.view.destroy();
    this.onTileDestroyed(t);
    return true;
  }

  private onTileDestroyed(t: TileRec): void {
    this.score += 1;
    this.updateScriptAct();
    this.svc.audio.hit();
    this.shatter.explode(10, t.cx, t.cy);
    this.sparks.explode(4 + Math.floor(this.rng() * 3), t.cx, t.cy);
    this.shockwave(t.cx, t.cy, 0.9);
    const now = Date.now();
    if (now - this.lastShakeAt > 400) {
      this.lastShakeAt = now;
      this.cameras.main.shake(60, 0.0015);
    }

    if (this.score % SCORE_PER_LEVEL === 0) {
      this.level += 1;
      this.gameSpeed += SPEED_PER_LEVEL;
      this.svc.audio.levelup();
      // Level-up opens a pick-one-of-two perk overlay (run frozen, 8 s
      // countdown auto-picks) so levelling grants power, not just speed.
      this.openPerkPick();
    }

    if (this.rng() < dropChance(this.difficultyLevel())) {
      const tier = this.levelDef ? this.levelDef.itemTierCap : this.level;
      const pool = availableItems(tier, this.bulletSizeBoost);
      const pick = pool[Math.floor(this.rng() * pool.length)];
      if (pick) this.spawnItem(t.cx, t.cy, pick);
    }

    // Win condition for level/daily runs (boss levels end via bossDestroyed).
    if (this.levelDef && !this.levelDef.boss && !this.victoryStarted && this.score >= this.levelDef.targetKills) {
      this.startVictory();
    }
  }

  // ============================================================================
  // level-up perk pick
  // ============================================================================

  /** Current run state as the perk pool/apply logic sees it. */
  private perkState(): PerkState {
    return {
      fireRateBoost: this.fireRateBoost,
      bulletSizeBoost: this.bulletSizeBoost,
      pierceBoost: this.pierceBoost,
      speedBoost: this.speedBoost,
      weaponDurationBoost: this.weaponDurationBoost,
      shield: this.shield,
      shieldDuration: this.shieldDuration,
    };
  }

  private syncPerkState(s: PerkState): void {
    this.fireRateBoost = s.fireRateBoost;
    this.bulletSizeBoost = s.bulletSizeBoost;
    this.pierceBoost = s.pierceBoost;
    this.speedBoost = s.speedBoost;
    this.weaponDurationBoost = s.weaponDurationBoost;
    this.shield = s.shield;
    this.shieldDuration = s.shieldDuration;
    this.shieldRing.setVisible(this.shield);
  }

  /**
   * Freeze the run and offer two random perks; the 8 s countdown bar at the
   * top of the panel auto-picks a random one when it empties.
   */
  private openPerkPick(): void {
    if (this.perkLayer) return;
    const choices = rollPerkChoices(this.perkState(), this.rng);
    if (choices.length === 0) {
      this.popText(this.W / 2, this.H * 0.4, `等级 ${this.level}`, 26, this.COLORS.accent);
      return;
    }
    this.perkChoices = choices;
    this.perkCountdown = PERK_PICK_FRAMES;

    const cx = this.W / 2;
    const panelW = 460;
    const cardH = 96;
    const panelH = 118 + choices.length * (cardH + 16);
    const cy = this.H / 2;
    const layer = this.add.container(0, 0).setDepth(DEPTH.modal);

    const dim = this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.45).setInteractive();
    layer.add(dim);

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(cx - panelW / 2, cy - panelH / 2 + 8, panelW, panelH, 24);
    g.fillStyle(this.COLORS.panel, 1);
    g.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 24);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 24);
    layer.add(g);

    layer.add(this.text(cx, cy - panelH / 2 + 38, `等级 ${this.level} · 选择强化`, { size: 24, bold: true }));

    // Countdown bar: drains over PERK_PICK_FRAMES, then auto-picks.
    this.perkBarW = panelW - 80;
    this.perkBarX = cx;
    this.perkBarY = cy - panelH / 2 + 66;
    const barBg = this.add.graphics();
    barBg.fillStyle(0x000000, 0.12);
    barBg.fillRoundedRect(cx - this.perkBarW / 2, this.perkBarY, this.perkBarW, 10, 5);
    layer.add(barBg);
    this.perkBar = this.add.graphics();
    layer.add(this.perkBar);
    this.drawPerkBar();

    choices.forEach((perk, i) => {
      const y = cy - panelH / 2 + 96 + i * (cardH + 16) + cardH / 2;
      layer.add(this.buildPerkCard(perk, cx, y, panelW - 48, cardH));
    });

    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
    this.perkLayer = layer;
  }

  private drawPerkBar(): void {
    if (!this.perkBar) return;
    const ratio = Phaser.Math.Clamp(this.perkCountdown / PERK_PICK_FRAMES, 0, 1);
    this.perkBar.clear();
    this.perkBar.fillStyle(this.COLORS.accent, 1);
    if (ratio > 0) {
      this.perkBar.fillRoundedRect(this.perkBarX - this.perkBarW / 2, this.perkBarY, Math.max(10, this.perkBarW * ratio), 10, 5);
    }
  }

  private buildPerkCard(perk: PerkDef, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const card = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 16);
    g.fillStyle(0xffffff, 0.92);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.lineStyle(2, this.COLORS.accent, 0.55);
    g.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 15);
    card.add(g);
    card.add(this.text(-w / 2 + 22, -18, perk.name, { size: 20, bold: true, align: 'left', color: this.COLORS.textPrimary }));
    card.add(this.text(-w / 2 + 22, 14, perk.desc, { size: 14, align: 'left', color: this.COLORS.textSecondary }));
    card.setSize(w, h);
    // Container hit area is top-left-anchored (same convention as Button).
    card.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    card.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() > 14) return;
      this.pickPerk(perk.id);
    });
    return card;
  }

  private pickPerk(id: PerkId): void {
    if (!this.perkLayer) return;
    this.perkLayer.destroy();
    this.perkLayer = null;
    this.perkChoices = [];
    this.perkBar = null;
    const s = applyPerk(this.perkState(), id);
    this.syncPerkState(s);
    if (id === 'shield') this.svc.audio.shield();
    const perk = PERKS.find((p) => p.id === id);
    this.popText(this.W / 2, this.H * 0.4, `${perk?.name ?? ''}！`, 26, this.COLORS.accent);
    this.sparks.explode(8, this.W / 2, this.H * 0.4);
  }

  // ============================================================================
  // boss (campaign levels 10/20/30)
  // ============================================================================

  /**
   * A 3x octagon hovering under the HUD band, drifting +-40 px sideways on a
   * Sine loop. It never falls; every ~4 s it spits a wave of escort tiles.
   */
  private spawnBoss(hp: number): void {
    const shadow = this.add.image(0, 8, TEX.softCircle).setTint(0x9dbad8).setAlpha(0.2).setScale((BOSS_HALF * 2 + 20) / 256);
    const img = this.add.image(0, 0, tileTexture(8)).setTint(BOSS_TINT).setDisplaySize(BOSS_HALF * 2, BOSS_HALF * 2);
    const glaze = this.add.image(0, 0, TEX.tileHighlight).setDisplaySize(BOSS_HALF * 2, BOSS_HALF * 2);
    const label = this.add
      .text(0, -6, 'BOSS', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        resolution: this.dpr,
      })
      .setOrigin(0.5);
    const view = this.add.container(this.W / 2, BOSS_Y, [shadow, img, glaze, label]).setDepth(DEPTH.tiles);
    view.setScale(0.4);
    this.tweens.add({ targets: view, scaleX: 1, scaleY: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: view, x: this.W / 2 + BOSS_DRIFT_X, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 320 });
    this.boss = { hp, maxHp: hp, baseScale: img.scaleX, view, img };
    this.refreshTargetBar();
  }

  /** 5-9 escort tiles fanning out from under the boss, with a pop-in. */
  private spawnEscortWave(): void {
    const boss = this.boss;
    if (!boss) return;
    const count = 5 + Math.floor(this.rng() * 5);
    const healthRange = calculateTileHealthRange(this.playerPower(), this.difficultyLevel());
    const baseY = BOSS_Y + BOSS_HALF + TILE_SIZE / 2 + 8;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * (TILE_SPACING + 6) + (this.rng() - 0.5) * 24;
      const cx = Phaser.Math.Clamp(boss.view.x + spread, TILE_SIZE / 2 + 4, this.W - TILE_SIZE / 2 - 4);
      const health = Math.floor(this.rng() * (healthRange.max - healthRange.min + 1)) + healthRange.min;
      this.spawnTile(cx, baseY, health, i * 35);
    }
  }

  /** Bullet damage to the boss: white flash pulse, bar update, death check. */
  private damageBoss(amount: number): void {
    const boss = this.boss;
    if (!boss || this.victoryStarted) return;
    boss.hp -= amount;
    boss.img.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (boss.img.scene && this.boss === boss) boss.img.setTint(BOSS_TINT);
    });
    // Hit pulse on the face image only — the container carries the drift tween.
    this.tweens.killTweensOf(boss.img);
    boss.img.setScale(boss.baseScale);
    this.tweens.add({ targets: boss.img, scaleX: boss.baseScale * 1.05, scaleY: boss.baseScale * 1.05, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    this.refreshTargetBar();
    if (boss.hp <= 0) this.bossDestroyed();
  }

  private bossDestroyed(): void {
    const boss = this.boss;
    if (!boss) return;
    this.boss = null;
    const { x, y } = boss.view;
    boss.view.destroy();
    // Big send-off: triple shock ring, heavy sparks, 200 ms shake.
    this.shockwave(x, y, 2.4, 320, 0xffffff);
    this.time.delayedCall(90, () => this.shockwave(x, y, 1.8, 300, BOSS_TINT));
    this.time.delayedCall(180, () => this.shockwave(x, y, 1.2, 280, 0xffb703));
    this.shatter.explode(30, x, y);
    this.sparks.explode(40, x, y);
    this.cameras.main.shake(200, 0.01);
    this.svc.audio.explode();
    this.svc.vibration.explode();
    this.refreshTargetBar();
    this.startVictory();
  }

  // ============================================================================
  // items
  // ============================================================================

  private spawnItem(cx: number, cy: number, type: ItemType): void {
    const meta = ITEM_META[type];
    const img = this.add.image(0, 0, TEX.itemBox).setTint(meta.color).setDisplaySize(ITEM_DROP_SIZE, ITEM_DROP_SIZE);
    // skin flavour: accent ring around the box + accent-tinted glyph
    const ring = this.add.graphics();
    ring.lineStyle(2, this.COLORS.accent, 0.85);
    ring.strokeRoundedRect(-ITEM_DROP_SIZE / 2 - 2, -ITEM_DROP_SIZE / 2 - 2, ITEM_DROP_SIZE + 4, ITEM_DROP_SIZE + 4, 8);
    const glyph = this.add.image(0, 0, itemGlyph(type)).setTint(this.COLORS.accent);
    glyph.setDisplaySize(ITEM_DROP_SIZE * 0.62, ITEM_DROP_SIZE * 0.62);
    // Name label below the box, always visible while falling (the pickup
    // pop-text alone was too fleeting to learn the item names).
    const nameLabel = this.add.text(0, ITEM_DROP_SIZE / 2 + 12, itemName(this.themeId, type), {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1a2b3c',
      strokeThickness: 3,
      resolution: this.dpr,
    });
    nameLabel.setOrigin(0.5);
    // Inner container carries the idle float/wobble tweens so they never fight
    // the per-frame falling/magnet motion applied to the outer container.
    const inner = this.add.container(0, 0, [img, ring, glyph, nameLabel]);
    const view = this.add.container(cx, cy, [inner]).setDepth(DEPTH.items);
    inner.y = 4;
    this.tweens.add({ targets: inner, y: -4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    inner.rotation = -0.06;
    this.tweens.add({ targets: inner, rotation: 0.06, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.items.push({ x: cx, y: cy, type, active: true, view });
  }

  private pickupItem(type: ItemType): void {
    switch (type) {
      case 'uzi':
      case 'shotgun':
      case 'laser':
      case 'spread':
        this.pickupWeapon(type);
        break;
      case 'bomb':
        this.launchBomb('normal');
        break;
      case 'bigbomb':
        this.launchBomb('big');
        break;
      case 'diagonalbomb':
        this.launchBomb('diagonal');
        break;
      case 'horizontalbomb':
        this.launchBomb('horizontal');
        break;
      case 'linebomb':
        this.launchBomb('line');
        break;
      case 'shield':
        this.shield = true;
        this.shieldDuration = SHIELD_FRAMES;
        this.svc.audio.shield();
        break;
      case 'boomerang':
        this.throwBoomerang();
        break;
      case 'doublebullets':
        this.doubleBullets = true;
        showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'doublebullets')}激活！`);
        break;
      case 'speedboost':
        this.speedBoost += SPEED_BOOST_STEP;
        showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'speedboost')}：移动速度增加！`);
        break;
      case 'rapidfire':
        this.rapidFire = true;
        showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'rapidfire')}激活！`);
        break;
      case 'piercing':
        this.piercingBullets = true;
        showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'piercing')}激活！`);
        break;
      case 'shieldbooster':
        this.shieldBooster = true;
        this.shield = true;
        this.shieldDuration = STRONG_SHIELD_FRAMES;
        this.svc.audio.shield();
        showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'shieldbooster')}激活！`);
        break;
      case 'magnet':
        this.magneticRange += 50;
        showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'magnet')}：拾取范围增加！`);
        break;
      case 'bigbullets':
        if (this.bulletSizeBoost < MAX_BULLET_SIZE_BOOST) {
          this.bulletSizeBoost += 2;
          showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'bigbullets')}：子弹尺寸增加！`);
        } else {
          showToast(this, this.W / 2, this.H * 0.45, '子弹尺寸已达上限！');
        }
        break;
      case 'weaponduration':
        this.weaponDurationBoost += 0.5;
        showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'weaponduration')}：武器时间延长！`);
        break;
      case 'extralife':
        if (this.lives < MAX_LIVES) {
          this.lives += 1;
          showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, 'extralife')}+1！`);
        } else {
          showToast(this, this.W / 2, this.H * 0.45, '生命已满！');
        }
        break;
    }
    if (type !== 'shieldbooster' && type !== 'shield') this.svc.audio.pickup();
  }

  private pickupWeapon(type: SpecialWeaponType): void {
    const w = this.weapons[type];
    if (w.active) {
      w.level = Math.min(w.level + 1, WEAPON_MAX_LEVEL);
      const d = weaponDuration(type, this.level, this.weaponDurationBoost);
      w.duration = d;
      w.maxDuration = d;
    } else {
      const d = weaponDuration(type, this.level, this.weaponDurationBoost);
      this.weapons[type] = { active: true, level: 1, duration: d, maxDuration: d, cooldown: 0 };
    }
    showToast(this, this.W / 2, this.H * 0.45, `${itemName(this.themeId, type)} Lv${this.weapons[type].level}`);
  }

  // ============================================================================
  // bombs / boomerangs
  // ============================================================================

  private launchBomb(type: BombType): void {
    const params = BOMB_PARAMS[type];
    const sign = params.randomSignX ? (this.rng() > 0.5 ? 1 : -1) : 1;
    const x = this.px + PLAYER_WIDTH / 2;
    const y = this.py;
    const img = this.add.image(0, 0, TEX.bomb).setTint(params.color).setScale((params.bodyRadius * 2) / 40);
    const symbol = type === 'big' ? '大' : type === 'diagonal' ? '斜' : type === 'horizontal' ? '横' : type === 'line' ? '线' : '';
    const label = this.add
      .text(0, 2, symbol, { fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '11px', color: '#ffffff', resolution: this.dpr })
      .setOrigin(0.5);
    const view = this.add.container(x, y, [img, label]).setDepth(DEPTH.projectiles);
    this.bombs.push({ x, y, type, dirX: params.dirX * sign, dirY: params.dirY, active: true, view });
  }

  private explodeBomb(bomb: BombRec): void {
    bomb.active = false;
    bomb.view.destroy();
    this.svc.audio.explode();
    this.svc.vibration.explode();
    this.cameras.main.shake(120, 0.005);

    const params = BOMB_PARAMS[bomb.type];
    // Shock ring + additive flash + sparks; bigger rings for bigger bombs.
    const ringScale = params.isLine ? 1.2 : bomb.type === 'big' ? 2.2 : 1.5;
    this.shockwave(bomb.x, bomb.y, ringScale, 260);
    const flash = this.add
      .image(bomb.x, bomb.y, TEX.softCircle)
      .setTint(params.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.9)
      .setScale(0.3)
      .setDepth(DEPTH.effects);
    const flashScale = params.explosionRadius / 110;
    this.tweens.add({ targets: flash, scaleX: flashScale, scaleY: flashScale, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    this.sparks.explode(8, bomb.x, bomb.y);
    if (params.isLine) {
      const beam = this.add
        .rectangle(bomb.x, bomb.y, LINE_BOMB_HALF_WIDTH * 2, params.explosionRadius * 2, 0xffc8ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.6)
        .setScale(1, 0.08)
        .setDepth(DEPTH.effects);
      this.tweens.add({ targets: beam, scaleY: 1, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => beam.destroy() });
    }

    for (const t of this.tiles) {
      if (!t.active) continue;
      let shouldDamage = false;
      let distance = 0;
      if (params.isLine) {
        const hd = Math.abs(t.cx - bomb.x);
        const vd = Math.abs(t.cy - bomb.y);
        if (hd <= LINE_BOMB_HALF_WIDTH && vd <= params.explosionRadius) {
          shouldDamage = true;
          distance = vd;
        }
      } else {
        const dx = bomb.x - t.cx;
        const dy = bomb.y - t.cy;
        distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= params.explosionRadius) shouldDamage = true;
      }
      if (shouldDamage) {
        const ratio = 1 - distance / params.explosionRadius;
        const damage = Math.max(BOMB_MIN_DAMAGE, Math.floor(params.baseDamage * ratio));
        this.damageTile(t, damage);
      }
    }
  }

  private throwBoomerang(): void {
    const x = this.px + PLAYER_WIDTH / 2;
    const y = this.py;
    const view = this.add.image(x, y, TEX.boomerang).setTint(0xffdd00).setDepth(DEPTH.projectiles);
    this.boomerangs.push({
      startX: x,
      startY: y,
      x,
      y,
      time: 0,
      mode: 'arc',
      canBeCaught: false,
      hitTiles: new Set<number>(),
      killedThisFrame: false,
      dirX: 0,
      dirY: -1,
      active: true,
      view,
    });
  }

  private updateBoomerang(b: BoomerangRec): void {
    b.time++;
    b.killedThisFrame = false;
    b.view.rotation += 0.4;

    if (b.mode === 'arc' && b.time <= BOOMERANG.maxTime) {
      const progress = b.time / BOOMERANG.maxTime;
      if (progress < 0.6) {
        b.x = b.startX - progress * 1.5 * BOOMERANG.arcWidth;
      } else {
        const returnProgress = (progress - 0.6) * 2.5;
        b.x = b.startX - BOOMERANG.arcWidth * 0.9 + returnProgress * BOOMERANG.arcWidth * 0.9;
        b.canBeCaught = true;
      }
      const yOffset = -4 * BOOMERANG.arcHeight * progress * (1 - progress);
      b.y = b.startY + yOffset;
    } else if (b.mode === 'straight') {
      b.x += b.dirX * BOOMERANG.speed;
      b.y += b.dirY * BOOMERANG.speed;
      if (b.x < -50 || b.x > this.W + 50 || b.y < -50 || b.y > this.H + 50) {
        b.active = false;
        b.view.destroy();
        return;
      }
    } else {
      b.mode = 'returning';
      b.canBeCaught = true;
      const dx = b.startX - b.x;
      const dy = this.py - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < BOOMERANG.arriveDistance) {
        // Close enough to the launch line: catch or drop.
        const pdx = b.x - (this.px + PLAYER_WIDTH / 2);
        const pdy = b.y - (this.py + PLAYER_HEIGHT / 2);
        const pd = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pd < BOOMERANG.catchDistance && b.canBeCaught) {
          b.startX = this.px + PLAYER_WIDTH / 2;
          b.startY = this.py;
          b.x = b.startX;
          b.y = b.startY;
          b.time = 0;
          b.mode = 'arc';
          b.canBeCaught = false;
          b.hitTiles.clear();
          b.killedThisFrame = false;
          this.svc.audio.pickup();
        } else {
          b.active = false;
          b.view.destroy();
        }
        return;
      }
      b.x += (dx / distance) * BOOMERANG.speed * BOOMERANG.returnSpeedScale;
      b.y += (dy / distance) * BOOMERANG.speed * BOOMERANG.returnSpeedScale;
    }

    // Tile hits: passes through, 2 damage, once per tile per flight phase.
    for (const t of this.tiles) {
      if (!t.active) continue;
      const dx = b.x - t.cx;
      const dy = b.y - t.cy;
      if (Math.sqrt(dx * dx + dy * dy) < BOOMERANG.radius + TILE_SIZE / 2) {
        if (!b.hitTiles.has(t.id)) {
          b.hitTiles.add(t.id);
          if (this.damageTile(t, BOOMERANG.damage)) b.killedThisFrame = true;
        }
      }
    }

    // A kill late in the arc flips the boomerang into piercing straight mode.
    if (b.killedThisFrame && b.mode === 'arc' && b.time > BOOMERANG.maxTime * 0.3) {
      b.mode = 'straight';
      b.canBeCaught = false;
      b.dirX = b.x > this.W / 2 ? -0.3 : 0.3;
      b.dirY = -1;
      b.hitTiles.clear();
    }

    // Out-of-bounds arc flights force the return leg.
    if (b.mode === 'arc' && (b.x < -100 || b.x > this.W + 100 || b.y < -100)) {
      b.time = BOOMERANG.maxTime + 1;
    }

    b.view.setPosition(b.x, b.y);
    const tint = b.mode === 'straight' ? 0xff4444 : b.canBeCaught ? 0x44ff44 : 0xffdd00;
    b.view.setTint(tint);
  }

  // ============================================================================
  // shooting
  // ============================================================================

  private spawnBullet(x: number, y: number, kind: BulletKind, angleOffset: number, baseDamage: number): void {
    const radius = BULLET_RADIUS[kind] + this.bulletSizeBoost;
    const speed = kind === 'laser' ? LASER_SPEED : BULLET_SPEED;
    const view = kind === 'laser'
      ? this.add.image(x, y, TEX.laserBolt).setTint(BULLET_COLORS[kind]).setScale(0.35, 0.4)
      : this.add.image(x, y, TEX.bullet).setTint(BULLET_COLORS[kind]).setScale((radius * 2) / 30);
    view.setDepth(DEPTH.projectiles);
    let damage = baseDamage;
    if (radius > 6) damage += Math.floor((radius - 6) / 2);
    this.bullets.push({
      x,
      y,
      kind,
      angleOffset,
      speed,
      radius,
      piercing: this.piercingBullets,
      hitCount: 0,
      maxHits: this.piercingBullets ? PIERCING_MAX_HITS + this.pierceBoost : 1 + this.pierceBoost,
      damage,
      active: true,
      view,
    });
  }

  private shoot(): void {
    if (this.globalCooldown > 0) return;
    const centerX = this.px + PLAYER_WIDTH / 2;
    const centerY = this.py;
    let shotsFired = false;

    for (const type of Object.keys(this.weapons) as WeaponType[]) {
      const w = this.weapons[type];
      if (!w.active || w.cooldown > 0) continue;

      switch (type) {
        case 'default':
          this.spawnBullet(centerX, centerY, 'normal', 0, 1);
          if (this.doubleBullets) {
            this.spawnBullet(centerX - 8, centerY, 'normal', 0, 1);
            this.spawnBullet(centerX + 8, centerY, 'normal', 0, 1);
          }
          break;
        case 'uzi': {
          const count = w.level >= 3 ? 2 : 1;
          for (let b = 0; b < count; b++) {
            this.spawnBullet(centerX + (b - 0.5) * 8, centerY - b * 5, 'normal', 0, 1);
          }
          if (this.doubleBullets) {
            for (let b = 0; b < count; b++) {
              this.spawnBullet(centerX - 6 + (b - 0.5) * 8, centerY - b * 5, 'normal', 0, 1);
              this.spawnBullet(centerX + 6 + (b - 0.5) * 8, centerY - b * 5, 'normal', 0, 1);
            }
          }
          break;
        }
        case 'shotgun': {
          const spread = Math.min(2 + w.level, 7);
          const kind: BulletKind = w.level >= 4 ? 'big' : 'normal';
          for (let i = -(spread - 1) / 2; i <= (spread - 1) / 2; i++) {
            this.spawnBullet(centerX + i * 12, centerY, kind, i * 0.4, 1);
          }
          if (this.doubleBullets) {
            for (let i = -(spread - 1) / 2; i <= (spread - 1) / 2; i++) {
              this.spawnBullet(centerX + i * 12, centerY - 8, kind, i * 0.4, 1);
            }
          }
          break;
        }
        case 'laser': {
          const kind: BulletKind = w.level >= 3 ? 'big' : 'laser';
          const count = w.level >= 5 ? 3 : 1;
          for (let l = 0; l < count; l++) {
            this.spawnBullet(centerX + (l - 1) * 15, centerY - l * 3, kind, 0, 3);
          }
          if (this.doubleBullets) {
            for (let l = 0; l < count; l++) {
              this.spawnBullet(centerX - 10 + (l - 1) * 15, centerY - l * 3, kind, 0, 3);
              this.spawnBullet(centerX + 10 + (l - 1) * 15, centerY - l * 3, kind, 0, 3);
            }
          }
          break;
        }
        case 'spread': {
          const count = Math.min(3 + w.level, 9);
          const kind: BulletKind = w.level >= 4 ? 'normal' : 'small';
          const angle = w.level >= 3 ? 0.4 : 0.3;
          for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
            this.spawnBullet(centerX, centerY, kind, i * angle, 1);
          }
          if (this.doubleBullets) {
            for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
              this.spawnBullet(centerX, centerY - 6, kind, i * angle, 1);
            }
          }
          break;
        }
      }

      w.cooldown = Math.max(1, Math.floor(weaponCooldown(type, w.level, this.rapidFire) * this.fireRateBoost));
      shotsFired = true;
    }

    if (shotsFired) {
      this.globalCooldown = GLOBAL_SHOT_COOLDOWN;
      this.svc.audio.shoot();
    }
  }

  // ============================================================================
  // per-frame update
  // ============================================================================

  override update(): void {
    if (!this.playing || this.paused) return;
    // Perk pick freezes the run; only its countdown keeps ticking (real
    // frames, so the 8 s budget survives low-fps devices).
    if (this.perkLayer) {
      this.perkCountdown--;
      this.drawPerkBar();
      if (this.perkCountdown <= 0) {
        const pick = this.perkChoices[Math.floor(this.rng() * this.perkChoices.length)];
        if (pick) this.pickPerk(pick.id);
      }
      return;
    }
    this.elapsedFrames++;
    // Boss levels: an escort wave every ~4 s until the boss goes down.
    if (this.boss && !this.victoryStarted && this.elapsedFrames % ESCORT_WAVE_FRAMES === 0) {
      this.spawnEscortWave();
    }

    this.handleInput();
    this.updatePlayerState();
    this.updateBullets();
    this.updateTiles();
    this.updateItems();
    for (const b of this.boomerangs) if (b.active) this.updateBoomerang(b);
    this.boomerangs = this.boomerangs.filter((b) => b.active);
    this.updateBombs();
    this.checkBulletTileCollisions();
    this.maintainRows();
    // Drop tiles far below the screen.
    for (const t of this.tiles) {
      if (t.active && t.cy - TILE_SIZE / 2 > this.H + 100) {
        t.active = false;
        t.view.destroy();
      }
    }
    this.tiles = this.tiles.filter((t) => t.active);
    this.refreshHud();
    this.drawWeaponBars();
  }

  private handleInput(): void {
    const prevX = this.px;
    const step = PLAYER_SPEED + this.speedBoost;
    if (this.keys.left && this.px > 0) this.px -= step;
    if (this.keys.right && this.px < this.W - PLAYER_WIDTH) this.px += step;
    if (this.pointerWorldX !== null) {
      const target = this.pointerWorldX - PLAYER_WIDTH / 2;
      const clamped = Phaser.Math.Clamp(target, 0, this.W - PLAYER_WIDTH);
      // Follow the finger, capped at the keyboard move speed per frame.
      const delta = clamped - this.px;
      const maxStep = step * 2;
      this.px += Phaser.Math.Clamp(delta, -maxStep, maxStep);
    }
    this.px = Phaser.Math.Clamp(this.px, 0, this.W - PLAYER_WIDTH);
    this.playerView.setPosition(this.px + PLAYER_WIDTH / 2, this.py + PLAYER_HEIGHT / 2);

    // Tilt into the motion (+-0.08 rad); ease back to level when idle.
    const vx = this.px - prevX;
    if (vx !== 0) {
      if (this.tiltTween) {
        this.tweens.killTweensOf(this.playerView);
        this.tiltTween = null;
      }
      this.playerView.rotation = Phaser.Math.Clamp((vx / step) * 0.08, -0.08, 0.08);
      // faint exhaust trail while moving
      this.trailFrame++;
      if (this.trailFrame % 3 === 0) {
        this.trailFx.emitParticleAt(this.px + PLAYER_WIDTH / 2, this.py + PLAYER_HEIGHT - 6, 1);
      }
    } else if (this.playerView.rotation !== 0 && !this.tiltTween) {
      this.tiltTween = this.tweens.add({
        targets: this.playerView,
        rotation: 0,
        duration: 120,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.tiltTween = null;
        },
      });
    }
  }

  private updatePlayerState(): void {
    for (const type of Object.keys(this.weapons) as WeaponType[]) {
      const w = this.weapons[type];
      if (w.duration > 0) {
        w.duration--;
        if (w.duration <= 0) {
          w.active = false;
          w.level = 1;
          w.maxDuration = 0;
        }
      }
      if (w.cooldown > 0) w.cooldown--;
    }
    this.weapons.default.active = true;

    if (this.shieldDuration > 0) {
      this.shieldDuration--;
      if (this.shieldDuration <= 0) this.shield = false;
    }
    this.shieldRing.setVisible(this.shield);
    // A shield granted while the run was frozen (perk pick) needs one paint.
    if (this.shield) this.shieldRing.setAlpha(this.shieldDuration < 60 ? 0.4 + 0.6 * Math.abs(Math.sin(this.shieldDuration * 0.2)) : 0.9);

    if (this.globalCooldown > 0) this.globalCooldown--;

    // Magnetic pickup attraction.
    if (this.magneticRange > 0) {
      const cx = this.px + PLAYER_WIDTH / 2;
      const cy = this.py + PLAYER_HEIGHT / 2;
      for (const item of this.items) {
        if (!item.active) continue;
        const dx = item.x - cx;
        const dy = item.y - cy;
        if (Math.sqrt(dx * dx + dy * dy) < this.magneticRange) {
          item.x -= dx * MAGNET_FORCE;
          item.y -= dy * MAGNET_FORCE;
        }
      }
    }

    this.shoot();
    this.checkPlayerTileCollision();
  }

  private checkPlayerTileCollision(): void {
    if (this.victoryStarted) return; // invulnerable during the victory cascade
    for (const t of this.tiles) {
      if (!t.active) continue;
      const half = TILE_SIZE / 2;
      const overlap =
        this.px < t.cx + half && this.px + PLAYER_WIDTH > t.cx - half && this.py < t.cy + half && this.py + PLAYER_HEIGHT > t.cy - half;
      if (!overlap) continue;

      if (this.shield) {
        // Shield and tile cancel each other out.
        this.shield = false;
        this.shieldDuration = 0;
        t.active = false;
        t.view.destroy();
        this.svc.audio.shield();
        showToast(this, this.W / 2, this.H * 0.45, '护盾抵挡了攻击！');
      } else {
        this.lives--;
        this.livesLost++;
        t.active = false;
        t.view.destroy();
        this.svc.audio.hurt();
        this.svc.vibration.error();
        this.flashVignette();
        this.cameras.main.shake(120, 0.006);
        if (this.lives <= 0) {
          this.gameOver();
          return;
        }
        // Brief invincibility, granted as a temporary shield like the original.
        this.shield = true;
        this.shieldDuration = INVINCIBLE_FRAMES;
        showToast(this, this.W / 2, this.H * 0.45, `生命-1! 剩余${this.lives}条生命`);
      }
    }
  }

  private updateBullets(): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.y -= b.speed;
      b.x += b.angleOffset * b.speed;
      if (b.y < 0 || b.x < 0 || b.x > this.W) {
        b.active = false;
        b.view.destroy();
        continue;
      }
      b.view.setPosition(b.x, b.y);
    }
    this.bullets = this.bullets.filter((b) => b.active);
  }

  private updateTiles(): void {
    const fall = tileFallSpeed(this.gameSpeed, this.playerPower(), this.difficultyLevel());
    for (const t of this.tiles) {
      if (!t.active) continue;
      t.cy += fall;
      t.view.setPosition(t.cx, t.cy);
    }
  }

  private updateItems(): void {
    for (const item of this.items) {
      if (!item.active) continue;
      item.y += ITEM_DROP_SPEED;
      item.view.setPosition(item.x, item.y);

      if (item.y > this.H + 20) {
        item.active = false;
        item.view.destroy();
        continue;
      }
      const half = ITEM_DROP_SIZE / 2;
      if (item.x - half < this.px + PLAYER_WIDTH && item.x + half > this.px && item.y - half < this.py + PLAYER_HEIGHT && item.y + half > this.py) {
        item.active = false;
        // shrink + fly into the player, then destroy
        const view = item.view;
        view.setScale(1.2);
        this.tweens.add({
          targets: view,
          scaleX: 0,
          scaleY: 0,
          x: this.px + PLAYER_WIDTH / 2,
          y: this.py + PLAYER_HEIGHT / 2,
          duration: 150,
          ease: 'Quad.easeIn',
          onComplete: () => view.destroy(),
        });
        const meta = ITEM_META[item.type];
        this.popText(item.x, item.y - 24, itemName(this.themeId, item.type), 18, meta.color);
        this.pickupItem(item.type);
      }
    }
    this.items = this.items.filter((i) => i.active);
  }

  private updateBombs(): void {
    for (const bomb of this.bombs) {
      if (!bomb.active) continue;
      const params = BOMB_PARAMS[bomb.type];
      bomb.x += bomb.dirX * params.speed;
      bomb.y += bomb.dirY * params.speed;
      bomb.view.setPosition(bomb.x, bomb.y);
      bomb.view.setAlpha(Math.floor(Date.now() / 150) % 2 === 0 ? 1 : 0.6);

      for (const t of this.tiles) {
        if (!t.active || !bomb.active) continue;
        const dx = bomb.x - t.cx;
        const dy = bomb.y - t.cy;
        if (Math.sqrt(dx * dx + dy * dy) < params.bodyRadius + TILE_SIZE / 2) {
          this.explodeBomb(bomb);
        }
      }

      if (bomb.active && (bomb.x < -50 || bomb.x > this.W + 50 || bomb.y < -50 || bomb.y > this.H + 50)) {
        bomb.active = false;
        bomb.view.destroy();
      }
    }
    this.bombs = this.bombs.filter((b) => b.active);
  }

  private checkBulletTileCollisions(): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      for (const t of this.tiles) {
        if (!t.active) continue;
        const dx = b.x - t.cx;
        const dy = b.y - t.cy;
        if (Math.sqrt(dx * dx + dy * dy) < b.radius + TILE_SIZE / 2) {
          if (b.piercing && b.hitCount < b.maxHits) {
            b.hitCount++;
          } else {
            b.active = false;
            b.view.destroy();
          }
          this.damageTile(t, b.damage);
          if (!b.active) break;
        }
      }
      // Boss hit: same radius rule, consumed unless piercing (same as tiles).
      const boss = this.boss;
      if (b.active && boss && !this.victoryStarted) {
        const dx = b.x - boss.view.x;
        const dy = b.y - boss.view.y;
        if (Math.sqrt(dx * dx + dy * dy) < b.radius + BOSS_HALF) {
          if (b.piercing && b.hitCount < b.maxHits) {
            b.hitCount++;
          } else {
            b.active = false;
            b.view.destroy();
          }
          this.damageBoss(b.damage);
        }
      }
    }
  }

  // ============================================================================
  // HUD
  // ============================================================================

  private playerPower(): number {
    return calculatePlayerPower({
      weapons: this.weapons,
      doubleBullets: this.doubleBullets,
      rapidFire: this.rapidFire,
      piercingBullets: this.piercingBullets,
      bulletSizeBoost: this.bulletSizeBoost,
      speedBoost: this.speedBoost,
    });
  }

  private refreshHud(force = false): void {
    const c = this.hudCache;
    if (force || c.score !== this.score) {
      c.score = this.score;
      this.scoreChipT.setText(`得分 ${this.score}`);
      const w = this.scoreChipT.width + 28;
      this.scoreChipG.clear();
      this.scoreChipG.fillStyle(0xffffff, 0.85);
      this.scoreChipG.fillRoundedRect(16, 12, w, 36, 18);
      this.refreshTargetBar();
    }
    const chip = this.mode === 'level' && this.levelDef ? `关卡 ${this.levelDef.id}` : this.mode === 'daily' ? '每日挑战' : `等级 ${this.level}`;
    if (force || c.chip !== chip) {
      c.chip = chip;
      this.levelChipT.setText(chip);
      const w = this.levelChipT.width + 24;
      this.levelChipG.clear();
      this.levelChipG.fillStyle(0xffffff, 0.85);
      this.levelChipG.fillRoundedRect(16, 52, w, 28, 14);
    }
    if (force || c.lives !== this.lives) {
      c.lives = this.lives;
      this.refreshHearts();
    }
    const power = this.playerPower();
    const info = `战力 ${power.toFixed(1)} · ${difficultyLabel(power)} · 模式 ${this.currentPattern}`;
    if (force || c.info !== info) {
      c.info = info;
      this.hudInfo.setText(info);
    }
  }

  /** Slim progress bar under the HUD band: target counter, or the boss HP bar. */
  private refreshTargetBar(): void {
    if (!this.targetGfx || !this.levelDef) return;
    const x = 16;
    const w = this.W - 32;
    const g = this.targetGfx;
    g.clear();
    g.fillStyle(0xffffff, 0.8);
    g.fillRoundedRect(x, 122, w, 10, 5);
    const inset = 2;
    if (this.levelDef.boss) {
      const maxHp = this.boss?.maxHp ?? this.levelDef.boss.hp;
      const hp = this.boss ? Math.max(0, this.boss.hp) : 0; // null == defeated
      const progress = Math.max(0, hp / maxHp);
      const innerW = (w - inset * 2) * progress;
      if (innerW >= 6) {
        g.fillStyle(this.COLORS.danger, 0.95);
        g.fillRoundedRect(x + inset, 122 + inset, innerW, 6, 3);
      }
      this.targetText?.setText(`BOSS ${hp}/${maxHp}`);
    } else {
      const target = this.levelDef.targetKills;
      const progress = Math.min(1, this.score / target);
      const innerW = (w - inset * 2) * progress;
      if (innerW >= 6) {
        g.fillStyle(this.COLORS.accent, 0.95);
        g.fillRoundedRect(x + inset, 122 + inset, innerW, 6, 3);
      }
      this.targetText?.setText(`目标 ${Math.min(this.score, target)}/${target}`);
    }
  }

  private refreshHearts(): void {
    for (const h of this.hearts) h.destroy();
    this.hearts = [];
    for (let i = 0; i < this.lives; i++) {
      const heart = this.add.image(this.W - 24 - i * 26, 92, TEX.heart).setTint(this.COLORS.heart).setScale(0.32).setDepth(DEPTH.hud);
      this.hearts.push(heart);
    }
  }

  /** Weapon timer capsules + shield bar, redrawn each frame (bottom-right). */
  private drawWeaponBars(): void {
    const g = this.barGfx;
    g.clear();

    const active = SPECIAL_WEAPONS.filter((t) => this.weapons[t].active);
    const pillW = 132;
    const pillH = 22;
    for (let i = 0; i < 4; i++) {
      const label = this.barLabels[i];
      const time = this.barTimes[i];
      const type = active[i];
      // Destroyed texts (e.g. a stale reference during scene shutdown) have
      // no live texture frame — setText on them crashes Phaser.
      if (!label || !time || !label.scene || !time.scene) continue;
      if (!type) {
        label.setVisible(false);
        time.setVisible(false);
        continue;
      }
      const w = this.weapons[type];
      const px = this.W - 16 - pillW;
      const py = this.H - 44 - i * (pillH + 8);
      const progress = w.maxDuration > 0 ? w.duration / w.maxDuration : 0;
      const blink = progress < 0.2 && Math.floor(Date.now() / 200) % 2 === 1;

      // capsule: white base + coloured progress fill
      g.fillStyle(0xffffff, blink ? 0.5 : 0.8);
      g.fillRoundedRect(px, py, pillW, pillH, pillH / 2);
      const inset = 3;
      const innerH = pillH - inset * 2;
      const bw = (pillW - inset * 2) * progress;
      if (bw >= innerH) {
        const baseColor = WEAPON_BAR_COLORS[type];
        const fill = progress > 0.6 ? baseColor : progress > 0.3 ? 0xffdd00 : 0xff4444;
        g.fillStyle(fill, blink ? 0.55 : 0.95);
        g.fillRoundedRect(px + inset, py + inset, bw, innerH, innerH / 2);
      }

      label.setVisible(true);
      label.setPosition(px + 12, py + pillH / 2);
      label.setText(`${itemName(this.themeId, type)} Lv${w.level}`);
      time.setVisible(true);
      time.setPosition(px + pillW - 10, py + pillH / 2);
      time.setText(`${Math.ceil(w.duration / 60)}s`);
    }

    // Shield bar under the player.
    if (this.shield && this.shieldDuration > 0) {
      const max = this.shieldBooster ? STRONG_SHIELD_FRAMES : SHIELD_FRAMES;
      const progress = Math.min(1, this.shieldDuration / max);
      const bw = 50;
      const bx = this.px + PLAYER_WIDTH / 2 - bw / 2;
      const by = this.py + PLAYER_HEIGHT + 12;
      g.fillStyle(0xffffff, 0.8);
      g.fillRoundedRect(bx - 1, by - 1, bw + 2, 7, 3.5);
      g.fillStyle(progress > 0.3 ? 0x00e5e5 : 0x0088aa, 1);
      g.fillRoundedRect(bx, by, Math.max(4, bw * progress), 5, 2.5);
    }
  }

  // ============================================================================
  // pause / game over
  // ============================================================================

  private togglePause(): void {
    if (!this.playing) return;
    this.paused = !this.paused;
    if (this.paused) this.showPauseOverlay();
    else {
      this.pauseLayer?.destroy();
      this.pauseLayer = null;
    }
  }

  private showPauseOverlay(): void {
    this.pauseLayer?.destroy();
    const layer = this.add.container(0, 0).setDepth(DEPTH.modal);
    const shade = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, this.COLORS.overlay, 0.55).setInteractive();
    layer.add(shade);
    const panel = this.add.container(this.W / 2, this.H / 2);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-180, -150, 360, 320, 30);
    g.fillStyle(this.COLORS.panel, 1);
    g.fillRoundedRect(-180, -160, 360, 320, 30);
    g.lineStyle(2, 0xffffff, 0.35);
    g.strokeRoundedRect(-180, -160, 360, 320, 30);
    panel.add(g);
    const title = this.text(0, -100, '已暂停', { size: 30, bold: true });
    panel.add(title);
    const resume = new Button(this, 0, -10, { label: '继续游戏', width: 220, height: 56, onClick: () => this.togglePause() });
    const home = new Button(this, 0, 70, { label: '返回主页', variant: 'secondary', width: 220, height: 56, onClick: () => this.exitToHome() });
    panel.add([resume, home]);
    layer.add(panel);
    this.pauseLayer = layer;
  }

  private exitToHome(): void {
    this.finalizeRun();
    this.perkLayer?.destroy();
    this.perkLayer = null;
    this.go(this.mode === 'level' ? 'LevelSelectScene' : this.mode === 'daily' ? 'DailyScene' : 'HomeScene');
  }

  private elapsedMs(): number {
    return Math.round((this.elapsedFrames / 60) * 1000);
  }

  /**
   * Evaluate achievements against the post-run save snapshot; newly unlocked
   * ones are persisted, their coin rewards paid out, and a toast shown.
   * Returns the freshly unlocked defs (empty when nothing new).
   */
  private checkAndGrantAchievements(run: RunSummary): AchievementDef[] {
    return runAchievementsCheck(this, run);
  }

  private finalizeRun(): void {
    if (this.finalized) return;
    this.finalized = true;
    // Only endless runs feed the all-time high score; level/daily results are
    // recorded at the moment of victory/defeat instead.
    if (this.mode === 'endless') this.svc.save.recordGameResult(this.score, this.level);
  }

  private gameOver(): void {
    this.playing = false;
    this.lives = 0;
    if (this.mode === 'endless') this.endlessGameOver();
    else this.defeat();
  }

  // ============================================================================
  // victory / defeat (level & daily modes)
  // ============================================================================

  /**
   * Target reached: stop spawning rows, chain-explode whatever tiles remain
   * (top to bottom, 30 ms apart), then confetti + fanfare + the result modal.
   */
  private startVictory(): void {
    this.victoryStarted = true;
    // A target can land on the same kill as a level-up (for example L4 at
    // 64 kills). Victory takes precedence: don't leave the perk picker over
    // the clear animation/result modal when there is no next wave to use it.
    this.perkLayer?.destroy();
    this.perkLayer = null;
    this.perkChoices = [];
    this.perkCountdown = 0;
    this.perkBar = null;
    const remaining = this.tiles.filter((t) => t.active).sort((a, b) => a.cy - b.cy || a.cx - b.cx);
    remaining.forEach((t, i) => {
      this.time.delayedCall(i * 30, () => {
        if (!t.active) return;
        t.active = false;
        this.shatter.explode(10, t.cx, t.cy);
        this.sparks.explode(5, t.cx, t.cy);
        this.shockwave(t.cx, t.cy, 0.9);
        t.view.destroy();
      });
    });
    const clearedAt = remaining.length * 30 + 150;
    this.time.delayedCall(clearedAt, () => {
      this.playing = false;
      this.svc.audio.win();
      this.svc.vibration.win();
      this.confettiFx.start();
      this.time.delayedCall(1600, () => this.confettiFx.stop());
    });
    this.time.delayedCall(clearedAt + 450, () => this.showVictory());
  }

  private starCount(): number {
    return this.livesLost === 0 ? 3 : this.livesLost <= 1 ? 2 : 1;
  }

  private showVictory(): void {
    const def = this.levelDef;
    if (!def) return;
    const timeMs = this.elapsedMs();
    const stars = this.starCount();
    // Coins: campaign pays 30 on first clear / 10 on replays; daily pays 20 on
    // today's first clear (pending flag captured at run start, so a failed
    // attempt earlier today doesn't consume it).
    let coins = 0;
    if (this.mode === 'level') {
      const firstClear = !this.svc.save.get().campaign.records[def.id];
      coins = campaignCoinReward(firstClear);
      this.svc.save.recordCampaignResult(def.id, stars, timeMs, this.score);
    } else if (this.mode === 'daily') {
      coins = this.dailyRewardPending ? COINS_DAILY : 0;
      this.svc.save.recordDailyResult(this.dateKey, stars, timeMs, this.score);
    }
    if (coins > 0) this.svc.save.addCoins(coins);
    this.finalized = true;

    const bonus = this.checkAndGrantAchievements({ mode: this.mode, bossDefeated: this.mode === 'level' && !!def.boss, stars });

    const hasNext = this.mode === 'level' && def.id < 30;
    const modal = new Modal(this, this.W, this.H, {
      width: 400,
      height: 500,
      title: this.mode === 'level' ? `关卡 ${def.id} 完成！` : '每日挑战完成！',
    });

    // Three stars popping in one by one (Arrow Flow rhythm: 250 + i*260 ms,
    // scale 0 -> 1, 320 ms Back.easeOut); unearned stars stay dim.
    const row = this.add.container(0, -122);
    modal.panel.add(row);
    for (let i = 0; i < 3; i++) {
      const star = this.add.image((i - 1) * 84, 0, TEX.glyphStar).setTint(i < stars ? 0xffb703 : 0xc9d9e8);
      star.setDisplaySize(58, 58);
      const targetScale = star.scaleX;
      star.setScale(0);
      row.add(star);
      this.tweens.add({ targets: star, scaleX: targetScale, scaleY: targetScale, delay: 250 + i * 260, duration: 320, ease: 'Back.easeOut' });
      if (i < stars) this.time.delayedCall(250 + i * 260, () => this.svc.audio.pickup());
    }

    modal.panel.add(this.text(0, -48, `用时 ${formatTimeMs(timeMs)} · 消灭 ${this.score}`, { size: 17, bold: true }));
    modal.panel.add(
      this.text(0, -16, stars === 3 ? '完美通关，一命未失！' : stars === 2 ? '仅失一命，表现出色！' : '通关成功，试试无伤挑战！', {
        size: 13,
        color: this.COLORS.textSecondary,
      }),
    );
    if (coins > 0) modal.panel.add(this.text(0, 14, `+${coins} 金币`, { size: 16, bold: true, color: 0xcc8800 }));

    const buttons: Button[] = [];
    if (hasNext) {
      buttons.push(
        new Button(this, 0, 76, {
          label: `下一关 Lv${def.id + 1}`,
          width: 280,
          height: 58,
          onClick: () => this.go('GameScene', { mode: 'level', level: getCampaignLevel(def.id + 1) } satisfies GameSceneData),
        }),
      );
      buttons.push(new Button(this, 0, 148, { label: '重玩本关', variant: 'secondary', width: 280, height: 52, onClick: () => this.refresh(this.runData) }));
      buttons.push(
        new Button(this, 0, 214, { label: '返回', variant: 'secondary', width: 280, height: 52, onClick: () => this.go('LevelSelectScene') }),
      );
    } else {
      buttons.push(new Button(this, 0, 100, { label: '再玩一次', width: 280, height: 58, onClick: () => this.refresh(this.runData) }));
      buttons.push(
        new Button(this, 0, 172, {
          label: '返回',
          variant: 'secondary',
          width: 280,
          height: 52,
          onClick: () => this.go(this.mode === 'daily' ? 'DailyScene' : 'LevelSelectScene'),
        }),
      );
    }
    modal.panel.add(buttons);
    this.overLayer = modal;
    if (bonus.length > 0) {
      this.time.delayedCall(450, () => this.showAchievementCards(bonus, modal.panelHeight));
    }
  }

  private defeat(): void {
    // A failed daily run still counts as showing up (0 stars keeps the streak).
    if (this.mode === 'daily') this.svc.save.recordDailyResult(this.dateKey, 0, this.elapsedMs(), this.score);
    this.finalized = true;
    this.svc.audio.gameover();
    const bonus = this.checkAndGrantAchievements({ mode: this.mode, stars: 0 });

    const modal = new Modal(this, this.W, this.H, { width: 400, height: 430, title: '挑战失败' });
    const icon = this.add.container(0, -112);
    const g = this.add.graphics();
    g.fillStyle(this.COLORS.danger, 1);
    g.fillCircle(0, 0, 36);
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(-8, -10, 14);
    icon.add([g, this.text(0, -2, '✕', { size: 38, bold: true, color: 0xffffff })]);
    icon.setScale(0.6);
    this.tweens.add({ targets: icon, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    modal.panel.add(icon);

    modal.panel.add(this.text(0, -42, `进度 ${this.score} / ${this.levelDef?.targetKills ?? 0}`, { size: 22, bold: true }));
    modal.panel.add(this.text(0, -10, '再接再厉，目标就在前方！', { size: 13, color: this.COLORS.textSecondary }));
    modal.panel.add([
      new Button(this, 0, 72, { label: '重试', width: 280, height: 58, onClick: () => this.refresh(this.runData) }),
      new Button(this, 0, 146, {
        label: '返回',
        variant: 'secondary',
        width: 280,
        height: 52,
        onClick: () => this.go(this.mode === 'daily' ? 'DailyScene' : 'LevelSelectScene'),
      }),
    ]);
    this.overLayer = modal;
    if (bonus.length > 0) {
      this.time.delayedCall(450, () => this.showAchievementCards(bonus, modal.panelHeight));
    }
  }

  private endlessGameOver(): void {
    const { newHighScore, newBestLevel } = this.svc.save.recordGameResult(this.score, this.level);
    this.finalized = true;
    const coins = endlessCoinReward(this.score);
    if (coins > 0) this.svc.save.addCoins(coins);
    const bonus = this.checkAndGrantAchievements({ mode: 'endless' });
    const isRecord = newHighScore || newBestLevel;
    if (isRecord) {
      this.svc.audio.win();
      this.svc.vibration.win();
    } else {
      this.svc.audio.gameover();
    }

    const modal = new Modal(this, this.W, this.H, { width: 400, height: 470, title: '游戏结束' });
    if (isRecord) {
      const badge = this.add.container(0, -148);
      const bg = this.add.graphics();
      bg.fillStyle(0xffb703, 1);
      bg.fillRoundedRect(-64, -16, 128, 32, 16);
      bg.fillStyle(0xffffff, 0.25);
      bg.fillRoundedRect(-58, -13, 116, 13, 6);
      const bt = this.text(0, 0, '新纪录！', { size: 17, bold: true, color: 0x7a4d00 });
      badge.add([bg, bt]);
      modal.panel.add(badge);
      this.tweens.add({ targets: badge, scaleX: 1.1, scaleY: 1.1, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // confetti rain from the top for 1.2s
      this.confettiFx.start();
      this.time.delayedCall(1200, () => this.confettiFx.stop());
    }
    modal.panel.add(this.text(0, -62, String(this.score), { size: 44, bold: true }));
    modal.panel.add(this.text(0, -20, '最终得分', { size: 14, color: this.COLORS.textSecondary }));
    modal.panel.add(this.text(0, 24, `等级 Lv${this.level} · 消灭瓦片 ${this.score}`, { size: 15, color: this.COLORS.textSecondary }));
    modal.panel.add(this.text(0, 52, `历史最高 ${this.svc.save.get().highScore}`, { size: 13, color: this.COLORS.textSecondary }));
    if (coins > 0) modal.panel.add(this.text(0, 80, `+${coins} 金币`, { size: 15, bold: true, color: 0xcc8800 }));
    const again = new Button(this, 0, 148, { label: '再来一局', width: 280, height: 62, onClick: () => this.refresh() });
    const home = new Button(this, 0, 224, { label: '返回主页', variant: 'secondary', width: 280, height: 56, onClick: () => this.go('HomeScene') });
    modal.panel.add([again, home]);
    this.overLayer = modal;
    if (bonus.length > 0) {
      this.time.delayedCall(450, () => this.showAchievementCards(bonus, modal.panelHeight));
    }
  }

  /**
   * Achievement unlock cards in their own floating panel BELOW the result
   * modal — they used to be one 13 px line squeezed between the modal's rows
   * and buttons, unreadable. Tap anywhere on the panel to dismiss it; it
   * auto-dismisses after ~6 s, and dies with the modal (display-list destroy).
   */
  private showAchievementCards(defs: AchievementDef[], modalHeight: number): void {
    if (!this.overLayer?.scene) return; // player already left the modal
    const cardW = 380;
    const rowH = 44;
    const panelH = 62 + defs.length * rowH;
    const cx = this.W / 2;
    // Below the modal, but never closer than 24 px to the screen bottom.
    const topY = Math.min(this.H / 2 + modalHeight / 2 + 14, this.H - panelH - 24);
    const cy = topY + panelH / 2;

    const layer = this.add.container(0, 0).setDepth(DEPTH.toast);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(cx - cardW / 2, topY + 5, cardW, panelH, 18);
    g.fillStyle(this.COLORS.panel, 1);
    g.fillRoundedRect(cx - cardW / 2, topY, cardW, panelH, 18);
    g.lineStyle(2, 0xffb703, 0.8);
    g.strokeRoundedRect(cx - cardW / 2 + 1, topY + 1, cardW - 2, panelH - 2, 17);
    layer.add(g);
    layer.add(this.text(cx, topY + 28, '🏆 解锁成就', { size: 17, bold: true, color: this.COLORS.accent }));

    defs.forEach((def, i) => {
      const my = topY + 52 + i * rowH + rowH / 2 - 6;
      const mx = cx - cardW / 2 + 34;
      const medal = this.add.graphics();
      medal.fillStyle(0xffb703, 1);
      medal.fillCircle(mx, my, 14);
      medal.fillStyle(0xcc8800, 1);
      medal.fillCircle(mx, my, 8);
      layer.add(medal);
      layer.add(this.text(mx, my - 1, '✓', { size: 13, bold: true, color: 0xffffff }));
      layer.add(this.text(mx + 26, my - 10, def.name, { size: 16, bold: true, align: 'left', color: this.COLORS.textPrimary }));
      layer.add(this.text(mx + 26, my + 10, `+${def.reward} 金币`, { size: 12, align: 'left', color: 0xcc8800 }));
    });

    // Tap to dismiss early.
    const zone = this.add.zone(cx, cy, cardW, panelH).setInteractive();
    zone.on('pointerup', () => dismiss());
    layer.add(zone);

    layer.setAlpha(0);
    layer.y = 24;
    this.tweens.add({ targets: layer, alpha: 1, y: 0, duration: 240, ease: 'Back.easeOut' });
    let dismissed = false;
    const dismiss = (): void => {
      if (dismissed || !layer.scene) return;
      dismissed = true;
      this.tweens.killTweensOf(layer);
      this.tweens.add({ targets: layer, alpha: 0, y: 12, duration: 160, onComplete: () => layer.destroy() });
    };
    this.time.delayedCall(6000, dismiss);
  }
}
