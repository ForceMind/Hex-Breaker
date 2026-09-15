# 🧩 架构与核心模块 API

本文档描述 Hex Breaker 2.0 的代码结构与各模块的公开接口。代码分三层：

- **`src/core/`**：纯游戏逻辑（数值、公式、阵型），**不依赖 Phaser**，全部可单元测试
- **`src/services/`**：平台服务（存档 / 音频 / 震动），同样不依赖 Phaser
- **`src/game/`**：Phaser 场景、UI 组件与程序生成贴图

所有时间类数值以「帧」为单位，按 60 fps 计（1 帧 = 1/60 s）。

---

## 一、core 层（纯逻辑）

### `src/core/types.ts`

共享类型定义，仅含类型与常量数组，无运行逻辑。

```ts
type WeaponType = 'default' | 'uzi' | 'shotgun' | 'laser' | 'spread';
type SpecialWeaponType = Exclude<WeaponType, 'default'>;
const SPECIAL_WEAPONS: readonly SpecialWeaponType[];   // ['uzi','shotgun','laser','spread']
const WEAPON_TYPES: readonly WeaponType[];             // ['default', ...SPECIAL_WEAPONS]

type BombType = 'normal' | 'big' | 'diagonal' | 'horizontal' | 'line';
type BulletKind = 'normal' | 'laser' | 'small' | 'big';
type ItemType = SpecialWeaponType
  | 'bomb' | 'bigbomb' | 'diagonalbomb' | 'horizontalbomb' | 'linebomb'
  | 'shield' | 'boomerang'
  | 'doublebullets' | 'speedboost' | 'rapidfire' | 'piercing' | 'shieldbooster'
  | 'magnet' | 'bigbullets' | 'weaponduration' | 'extralife';
type PatternType = 'corridor' | 'walls' | 'center' | 'sides' | 'gaps' | 'zigzag'
  | 'diamond' | 'wave' | 'tunnel' | 'stairs' | 'cross' | 'random' | 'barrier';

interface WeaponState { active: boolean; level: number; duration: number; maxDuration: number; cooldown: number; }
interface PowerInput {                            // 难度模型读取的玩家状态子集
  weapons: Record<WeaponType, WeaponState>;
  doubleBullets: boolean;
  rapidFire: boolean;
  piercingBullets: boolean;
  bulletSizeBoost: number;
  speedBoost: number;
}
interface HealthRange { min: number; max: number; }
interface BombParams {                            // 炸弹参数（见 BOMB_PARAMS）
  speed: number; explosionRadius: number; baseDamage: number;
  dirX: number; dirY: number; randomSignX: boolean;
  bodyRadius: number; isLine: boolean; color: number; name: string;
}
```

### `src/core/config.ts`

全部玩法数值表与取值函数。常量分类速览：

| 分组 | 常量 |
| --- | --- |
| 棋盘 / 流动 | `TILE_SIZE` 50、`TILE_SPACING` 55、`INITIAL_ROWS` 4、`INITIAL_HEALTH_MAX` 2、`FIRST_ROW_Y` 10 |
| 生命 / 升级 | `START_LIVES` 3、`MAX_LIVES` 9、`INVINCIBLE_FRAMES` 120、`SCORE_PER_LEVEL` 8、`SPEED_PER_LEVEL` 0.09 |
| 玩家 | `PLAYER_WIDTH` / `PLAYER_HEIGHT` 40、`PLAYER_SPEED` 5、`PLAYER_BOTTOM_MARGIN` 60 |
| 增益步长 | `MAX_BULLET_SIZE_BOOST` 8、`MAGNET_STEP` 50、`MAGNET_FORCE` 0.3、`SPEED_BOOST_STEP` 2、`WEAPON_DURATION_STEP` 0.5 |
| 武器 | `WEAPON_MAX_LEVEL` 5、`WEAPON_BASE_DURATION` 600、`WEAPON_LEVEL_DURATION` 60、`WEAPON_DURATION_BONUS`、`GLOBAL_SHOT_COOLDOWN` 3、`WEAPON_NAMES`、`WEAPON_BAR_COLORS` |
| 子弹 | `BULLET_SPEED` 8、`LASER_SPEED` 12、`BULLET_RADIUS`、`BULLET_COLORS`、`LASER_DAMAGE` 3、`PIERCING_MAX_HITS` 3 |
| 炸弹 | `BOMB_PARAMS: Record<BombType, BombParams>`、`EXPLOSION_FRAMES` 20、`BOMB_MIN_DAMAGE` 2、`LINE_BOMB_HALF_WIDTH` 30 |
| 回旋镖 | `BOOMERANG`（speed 6 / radius 15 / maxTime 120 / arcHeight 120 / arcWidth 150 / damage 2 / catchDistance 30 / arriveDistance 20 / returnSpeedScale 1.5） |
| 护盾 | `SHIELD_FRAMES` 300、`STRONG_SHIELD_FRAMES` 600 |
| 掉落 | `ITEM_UNLOCK_TIERS`、`ITEM_META`、`ITEM_DROP_SIZE` 30、`ITEM_DROP_SPEED` 2 |
| 阵型 | `SHAPED_ROW_MIN_LEVEL` 3、`SHAPED_ROW_CHANCE` 0.8、`PATTERN_NAMES`、`FULL_ROW_NAME` '传统' |

导出函数：

```ts
/** 各武器每轮齐射的基础间隔（帧），未计算连射减半。 */
function weaponBaseCooldown(type: WeaponType, level: number): number;
// default: 17 | uzi: max(3, 8-Lv) | shotgun: max(25, 40-2Lv)
// laser: max(35, 50-3Lv) | spread: max(12, 25-2Lv)

/** 实际生效的冷却：rapidFire 为 true 时减半（向下取整）。 */
function weaponCooldown(type: WeaponType, level: number, rapidFire: boolean): number;

/** 特殊武器持续帧数：(600 + Lv*60 + 武器加成) × durationBoost，向下取整。 */
function weaponDuration(type: SpecialWeaponType, level: number, durationBoost: number): number;

/** 每块瓦片被摧毁时的道具掉率：min(0.22, 0.055 + 0.015×level)。 */
function dropChance(level: number): number;

/** 当前等级掉落池：遍历 ITEM_UNLOCK_TIERS；bulletSizeBoost 达上限后移除 bigbullets。 */
function availableItems(level: number, bulletSizeBoost: number): ItemType[];
```

`ITEM_UNLOCK_TIERS` 按 L1 / L3 / L5 / L7 / L9 / L11 / L13 / L15 八档逐级扩充掉落池，L15 时全部 20 种道具解锁完毕。`ITEM_META` 提供每种道具的显示名与配色。

### `src/core/difficulty.ts`

战力驱动的动态难度模型。

```ts
/** 战力：1 + Σ(激活特殊武器 Lv×系数) + 永久增益加分 + 多持奖励(每种 0.5)。 */
function calculatePlayerPower(input: PowerInput): number;
// 武器系数 uzi 1.2 / shotgun 1.5 / laser 1.8 / spread 1.3
// 双子弹 +2，连射 +1.5，穿透 +1.3，大弹每层 +0.3，加速每层 +0.2；下限 1

/** 每行生成密度：min(0.9, 0.62 + min(power/12, 0.22) + min(level/24, 0.16))。 */
function calculateTileDensity(playerPower: number, level: number): number;

/** 瓦片血量区间：[⌊Lv/3⌋, Lv+2] × max(0.8, power/9) 取整，上限封顶 40。 */
function calculateTileHealthRange(playerPower: number, level: number): HealthRange;

/** 每帧下落速度：gameSpeed × 0.42 × min(1.4, 1 + (power-1)/15)。 */
function tileFallSpeed(gameSpeed: number, playerPower: number): number;

type DifficultyLabel = '简单' | '稍难' | '中等' | '困难' | '地狱';
/** power < 5 简单 / ≥5 稍难 / ≥8 中等 / ≥12 困难 / ≥15 地狱。 */
function difficultyLabel(playerPower: number): DifficultyLabel;
```

### `src/core/patterns.ts`

13 种行阵型生成。每个阵型产出长度 `tilesPerRow` 的布尔掩码，`true` 表示该列生成瓦片。

```ts
const PATTERN_TYPES: readonly PatternType[];   // 13 种阵型标识

/** 随机挑选一种阵型；可注入 rng 便于测试。 */
function pickPattern(rng?: () => number): PatternType;

/** 生成指定阵型的布尔掩码；tunnel / random 内部使用注入的 rng。 */
function generatePattern(patternType: PatternType, tilesPerRow: number, rng?: () => number): boolean[];
```

阵型一览（中文名见 `PATTERN_NAMES`）：`corridor` 走廊、`walls` 墙壁、`center` 中央、`sides` 两侧、`gaps` 间隙、`zigzag` 之字、`diamond` 菱形、`wave` 波浪、`tunnel` 隧道、`stairs` 阶梯、`cross` 十字、`random` 随机、`barrier` 障碍。

### `src/core/prng.ts`

```ts
/** mulberry32 可播种伪随机数，返回 [0, 1) 发生器；供阵型测试注入确定性随机。 */
function mulberry32(seed: number): () => number;
```

---

## 二、services 层（平台服务）

### `src/services/save.ts`

localStorage 持久化，带版本化 schema、损坏数据迁移与内存降级（隐私模式 / 测试环境）。

```ts
const SAVE_KEY = 'hex-breaker:save';
const SAVE_VERSION = 1;

interface Settings { music: boolean; sound: boolean; vibration: boolean; }
interface SaveData {
  version: number;
  highScore: number;
  bestLevel: number;
  gamesPlayed: number;
  totalTilesDestroyed: number;
  settings: Settings;
}
interface StorageLike {                         // localStorage 的最小抽象
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultSave(): SaveData;               // 默认存档（全部开启、纪录清零）
function migrate(raw: unknown): SaveData;       // 任意历史/损坏数据 → 当前 schema
function isValidSave(data: SaveData): boolean;
function memoryStorage(): StorageLike;          // 内存降级实现

class SaveService {
  constructor(storage?: StorageLike);           // 不传则自动探测 localStorage，失败降级内存
  get(): SaveData;
  isPersistent(): boolean;                      // 是否真正落盘（内存降级时为 false）
  onChange(listener: (data: SaveData) => void): () => void;   // 订阅变更，返回退订函数
  save(): void;                                 // 校验后写盘并通知订阅者
  update(mutator: (data: SaveData) => void): void;            // 原地修改 + save()
  reset(): void;                                // 清空存档恢复默认
  recordGameStart(): void;                      // gamesPlayed +1
  recordGameResult(score: number, level: number): { newHighScore: boolean; newBestLevel: boolean };
}
```

### `src/services/audio.ts`

全部音效用 Web Audio API 实时合成（振荡器 + 噪声缓冲），不加载任何音频文件。`AudioContext` 在首次用户手势时惰性创建，规避自动播放限制。

```ts
class AudioService {
  unlock(): void;                // 由 pointer/keyboard 手势调用，可安全重复调用
  setSoundEnabled(v: boolean): void;   // 音效开关
  setMusicEnabled(v: boolean): void;   // 音乐开关（生成式和声，3 秒一个和弦）
  suspend(): void;               // 页面隐藏时挂起
  resume(): void;                // 页面可见时恢复

  // 游戏音效（shoot 有 70ms 节流，避免连发堆叠）
  shoot(): void;  hit(): void;  explode(): void;  pickup(): void;
  hurt(): void;   shield(): void; levelup(): void; gameover(): void;
  button(): void; win(): void;   // win = 新纪录号角
}
```

### `src/services/vibration.ts`

Vibration API 薄封装：仅在「支持 vibrate 且为触屏设备」时启用，其余情况静默。

```ts
class VibrationService {
  setEnabled(v: boolean): void;
  isSupported(): boolean;
  vibrate(pattern: number | number[]): void;
  tap(): void;       // 15ms，按钮点按
  error(): void;     // [30,40,30]，受击
  explode(): void;   // [40,30,60]，爆炸
  win(): void;       // [20,60,20,60,40]，新纪录
}
```

### `src/game/services.ts`

进程级服务单例组装，`main.ts` 启动时创建一次。

```ts
interface Services {
  save: SaveService;
  audio: AudioService;
  vibration: VibrationService;
  applySettings(): void;         // 把存档中的开关同步到 audio / vibration
}

function createServices(): Services;   // 创建并登记单例，随后立即 applySettings()
function services(): Services;         // 取单例；未初始化时抛错
```

---

## 三、场景与 UI（`src/game/`）

### 布局与调色板 `src/game/config/layout.ts`

```ts
const DESIGN_WIDTH = 540;            // 设计宽度（点）
const MIN_DESIGN_HEIGHT = 960;
const MAX_DESIGN_HEIGHT = 1200;      // 设计高度随视口宽高比在 960–1200 间自适应
const MAX_DPR = 2;                   // DPR 封顶
const FONT_FAMILY: string;           // 中文字体栈
const DEPTH: {...};                  // 渲染深度层（background -10 … toast 70）
const COLORS: {...};                 // 固定调色板（浅蓝游戏画面 + 深灰蓝页面底色）

function css(color: number): string;                       // 0xRRGGBB → '#rrggbb'
function computeDesignHeight(viewportWidth: number, viewportHeight: number): number;
function devicePixelRatioCapped(): number;                 // min(MAX_DPR, window.devicePixelRatio)，下限 1
```

### 场景基座 `src/game/scenes/BaseScene.ts`

```ts
abstract class BaseScene extends Phaser.Scene {
  protected readonly W = DESIGN_WIDTH;
  protected H: number;               // 实际设计高度（读 registry.designHeight）
  protected dpr: number;             // 读 registry.dpr
  protected svc: Services;           // 服务单例

  protected addBackground(): Background;              // 渐变背景 + 漂浮装饰
  protected fadeIn(duration?: number): void;          // 180ms 黑场淡入
  protected go(key: string, data?: object, duration?: number): void;  // 淡出后切场景，转场期间锁输入
  protected refresh(data?: object): void;             // 无黑场地重开当前场景
  text(x, y, content, opts?: TextOptions): Phaser.GameObjects.Text;   // DPR 清晰文本
  protected roundedRect(x, y, w, h, r, fill, alpha?, stroke?): Phaser.GameObjects.Graphics;
}
```

五个场景：`BootScene`（烘焙全部贴图 → 主页）、`HomeScene`（标题 / 纪录 / 三个入口）、`HelpScene`（可拖动滚动的玩法说明）、`SettingsScene`（三个开关 + 清除存档）、`GameScene`（战斗主循环，含 HUD / 暂停 / 结算）。

### UI 组件 `src/game/ui/`

```ts
// Button.ts —— Graphics 绘制的圆角按钮；按下缩放反馈，拖离 14px 不触发点击
class Button extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions);
  setLabel(text: string): this;
  setEnabled(v: boolean): this;      // 禁用时半透明
  setFill(color: number): this;
}
interface ButtonOptions {
  width?: number;                    // 默认 260
  height?: number;                   // 默认 64
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';   // 默认 primary
  fontSize?: number;                 // 默认 22
  radius?: number;
  fill?: number;                     // 覆盖变体填充色
  textColor?: number;
  onClick: () => void;
  enabled?: boolean;                 // 默认 true
  silent?: boolean;                  // true 时点击不播音效
}

// Modal.ts —— 遮罩 + 居中圆角面板；内容以面板中心为原点加进 panel
class Modal extends Phaser.GameObjects.Container {
  readonly panel: Phaser.GameObjects.Container;
  readonly panelWidth: number;
  readonly panelHeight: number;
  constructor(scene: Phaser.Scene, designWidth: number, designHeight: number, opts?: ModalOptions);
  close(onDone?: () => void): void;  // 收起动画后销毁
}
interface ModalOptions {
  width?: number;                    // 默认 440
  height?: number;                   // 默认 420
  title?: string;
  closeOnOverlay?: boolean;          // 点遮罩关闭
  onClose?: () => void;              // destroy 时回调
  depth?: number;                    // 默认 DEPTH.modal
}

// Toast.ts —— 短暂提示；同一场景同时最多一条
function showToast(scene: Phaser.Scene, x: number, y: number, message: string, duration?: number): void;
// duration 默认 1400ms

// Toggle.ts —— iOS 风格开关（72×40）
class Toggle extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, opts: ToggleOptions);
  getValue(): boolean;
}
interface ToggleOptions { value: boolean; onChange: (value: boolean) => void; }

// Background.ts —— 36 段垂直渐变 + 5 个缓慢漂移的柔光圆
class Background extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, width: number, height: number);
}
```

### 程序生成贴图 `src/game/rendering/textures.ts`

所有贴图由 Graphics API 以 2 倍尺寸烘焙为**白色底图**，显示时用 `setTint()` 上色（tint 为乘法，灰色区域烘出暗部层次）。瓦片按 1–8 层厚度各烘一张。

```ts
const TEX: {                          // 贴图 key 常量表
  player; shieldRing; bullet; laserBolt; itemBox; bomb; boomerang; heart;
  particle; spark; ring; softCircle; tileHighlight; tileGlow; vignette;
  glyphWeapon; glyphBomb; glyphShield; glyphMagnet; glyphBuff; glyphStar;
};

function tileTexture(thickness: number): string;   // 'hb-tile-N'，N 收拢到 1..8
function itemGlyph(type: ItemType): string;        // 道具盒上的白色剪影图标（按道具族归类）
function ensureTextures(scene: Phaser.Scene): void; // 幂等：已生成则直接返回
```

---

## 四、入口装配 `src/main.ts`

- `Phaser.AUTO` 渲染，画布尺寸 = 设计尺寸 × DPR（封顶 2），`Scale.FIT` 缩放
- `fps.target: 60`，`antialias: true`，`activePointers: 3`
- `audio: { noAudio: true }` —— 音效全部由 `AudioService` 合成，禁用 Phaser 音频管理器
- 场景注册顺序：`BootScene → HomeScene → HelpScene → SettingsScene → GameScene`
- registry 写入 `dpr` 与 `designHeight` 供各场景读取
- 五种手势事件（pointerdown / pointerup / touchend / click / keydown）统一触发 `audio.unlock()`
- 页面隐藏 / 可见时自动 `audio.suspend()` / `resume()`；拦截 iOS 双击缩放与 `gesturestart`
