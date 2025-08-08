# 🔧 API 文档

本文档描述了 Hex Breaker 游戏的主要类和方法接口。

## 📚 目录

- [核心类](#核心类)
- [游戏对象](#游戏对象)
- [工具函数](#工具函数)
- [配置参数](#配置参数)
- [事件系统](#事件系统)

## 核心类

### Player 类

玩家角色控制类。

```javascript
class Player {
    constructor()
    
    // 属性
    x: number              // X坐标
    y: number              // Y坐标
    width: number          // 宽度
    height: number         // 高度
    speed: number          // 移动速度
    weapon: string         // 当前武器类型
    weaponLevel: number    // 武器等级 (1-5)
    weaponDuration: number // 武器持续时间
    shield: boolean        // 护盾状态
    
    // 方法
    moveLeft(): void       // 向左移动
    moveRight(): void      // 向右移动
    update(): void         // 更新状态
    draw(): void           // 绘制玩家
    shoot(): void          // 发射子弹
    pickupItem(itemType: string): void  // 拾取道具
    useBomb(bombType: string): void     // 使用炸弹
    throwBoomerang(): void              // 投掷回旋镖
}
```

### Tile 类

瓦片对象类。

```javascript
class Tile {
    constructor(x: number, y: number, health: number)
    
    // 属性
    x: number              // X坐标
    y: number              // Y坐标
    size: number           // 尺寸
    health: number         // 当前血量
    maxHealth: number      // 最大血量
    originalHealth: number // 原始血量
    active: boolean        // 是否激活
    thickness: number      // 厚度层数
    
    // 方法
    update(): void                      // 更新位置
    draw(): void                        // 绘制瓦片
    takeDamage(amount: number): boolean // 受到伤害
}
```

### Bullet 类

子弹类，支持多种类型。

```javascript
class Bullet {
    constructor(x: number, y: number, type: string, angleOffset: number)
    
    // 属性
    x: number          // X坐标
    y: number          // Y坐标
    type: string       // 子弹类型 ('normal', 'laser', 'small')
    speed: number      // 飞行速度
    active: boolean    // 是否激活
    radius: number     // 碰撞半径
    
    // 方法
    update(): void                    // 更新位置
    draw(): void                      // 绘制子弹
    checkCollision(tile: Tile): boolean // 检查碰撞
}
```

### Bomb 类

炸弹类，支持多种爆炸类型。

```javascript
class Bomb {
    constructor(x: number, y: number, type: string)
    
    // 属性
    x: number              // X坐标
    y: number              // Y坐标
    type: string           // 炸弹类型
    active: boolean        // 是否激活
    exploded: boolean      // 是否已爆炸
    explosionRadius: number // 当前爆炸半径
    maxExplosionRadius: number // 最大爆炸半径
    
    // 炸弹类型
    // 'normal' - 普通炸弹
    // 'big' - 大型炸弹
    // 'diagonal' - 斜射炸弹
    // 'horizontal' - 横向炸弹
    // 'line' - 线性炸弹
    
    // 方法
    update(): void         // 更新状态
    draw(): void           // 绘制炸弹
    explode(): void        // 引爆炸弹
    setupBombType(): void  // 设置炸弹属性
}
```

### Boomerang 类

智能回旋镖类。

```javascript
class Boomerang {
    constructor(x: number, y: number)
    
    // 属性
    x: number              // 当前X坐标
    y: number              // 当前Y坐标
    startX: number         // 起始X坐标
    startY: number         // 起始Y坐标
    mode: string           // 飞行模式 ('arc', 'straight', 'returning')
    canBeCaught: boolean   // 是否可被接住
    hitTiles: Set          // 已击中的瓦片集合
    
    // 方法
    update(): void                    // 更新状态
    draw(): void                      // 绘制回旋镖
    checkTileCollisions(): void       // 检查瓦片碰撞
    switchToStraightMode(): void      // 切换到直线模式
    checkPlayerCatch(): void          // 检查玩家接住
    relaunch(): void                  // 重新发射
}
```

### ItemDrop 类

道具掉落类。

```javascript
class ItemDrop {
    constructor(x: number, y: number, type: string)
    
    // 属性
    x: number          // X坐标
    y: number          // Y坐标
    type: string       // 道具类型
    size: number       // 尺寸
    active: boolean    // 是否激活
    
    // 道具类型
    // 武器类: 'uzi', 'shotgun', 'laser', 'spread'
    // 炸弹类: 'bomb', 'bigbomb', 'diagonalbomb', 'horizontalbomb', 'linebomb'
    // 特殊类: 'shield', 'boomerang'
    
    // 方法
    update(): void     // 更新位置
    draw(): void       // 绘制道具
}
```

## 游戏对象

### 全局变量

```javascript
// 游戏状态
let gameState: string     // 'menu', 'playing', 'gameOver'
let score: number         // 当前分数
let level: number         // 当前等级
let gameSpeed: number     // 游戏速度倍率

// 游戏对象数组
let tiles: Tile[]         // 瓦片数组
let bullets: Bullet[]     // 子弹数组
let bombs: Bomb[]         // 炸弹数组
let boomerangs: Boomerang[] // 回旋镖数组
let itemDrops: ItemDrop[] // 道具数组

// 玩家对象
let player: Player        // 玩家实例

// Canvas相关
let canvas: HTMLCanvasElement  // Canvas元素
let ctx: CanvasRenderingContext2D // 渲染上下文
```

### 游戏配置

```javascript
// 帧率控制
const targetFPS = 60
const frameInterval = 1000 / targetFPS

// 武器配置
const weaponConfig = {
    'uzi': {
        name: '冲锋枪',
        cooldown: 8,     // 射击间隔
        duration: 600,   // 持续时间
        bulletType: 'normal'
    },
    'shotgun': {
        name: '霰弹枪',
        cooldown: 20,
        duration: 480,
        bulletType: 'normal',
        bulletCount: 3   // 同时发射数量
    },
    'laser': {
        name: '激光炮',
        cooldown: 15,
        duration: 420,
        bulletType: 'laser'
    },
    'spread': {
        name: '散射枪',
        cooldown: 12,
        duration: 360,
        bulletType: 'small',
        angles: [-20, -10, 0, 10, 20] // 发射角度
    }
}

// 炸弹配置
const bombConfig = {
    'normal': { speed: 6, radius: 80, damage: 4 },
    'big': { speed: 5, radius: 120, damage: 8 },
    'diagonal': { speed: 7, radius: 70, damage: 4 },
    'horizontal': { speed: 6, radius: 60, damage: 4 },
    'line': { speed: 8, radius: 40, damage: 6 }
}
```

## 工具函数

### 碰撞检测

```javascript
/**
 * 检查圆形碰撞
 * @param {Object} obj1 - 第一个对象 {x, y, radius}
 * @param {Object} obj2 - 第二个对象 {x, y, radius}
 * @returns {boolean} 是否碰撞
 */
function checkCircleCollision(obj1, obj2): boolean

/**
 * 检查矩形碰撞
 * @param {Object} rect1 - 第一个矩形 {x, y, width, height}
 * @param {Object} rect2 - 第二个矩形 {x, y, width, height}
 * @returns {boolean} 是否碰撞
 */
function checkRectCollision(rect1, rect2): boolean
```

### 游戏控制

```javascript
/**
 * 开始新游戏
 */
function startGame(): void

/**
 * 暂停游戏
 */
function pauseGame(): void

/**
 * 结束游戏
 */
function endGame(): void

/**
 * 重新开始游戏
 */
function restartGame(): void
```

### 瓦片管理

```javascript
/**
 * 创建新的瓦片行
 */
function createNewTileRow(): void

/**
 * 更新等级显示
 */
function updateLevelDisplay(): void

/**
 * 清理无效对象
 */
function cleanupObjects(): void
```

## 配置参数

### 可调整的游戏参数

```javascript
// 玩家设置
const PLAYER_SPEED = 5        // 玩家移动速度
const PLAYER_SIZE = 40        // 玩家尺寸

// 瓦片设置
const TILE_SIZE = 50          // 瓦片尺寸
const TILE_SPACING = 55       // 瓦片间距
const TILE_SPEED = 1          // 瓦片下落速度

// 升级设置
const POINTS_PER_LEVEL = 8    // 每级所需分数
const MAX_WEAPON_LEVEL = 5    // 武器最大等级

// 道具设置
const BASE_DROP_RATE = 0.08   // 基础掉落率
const DROP_RATE_INCREASE = 0.02 // 每级掉落率增加

// 难度设置
const DIFFICULTY_SCALING = {
    level1: { minHealth: 1, maxHealth: 3 },
    level2: { minHealth: 1, maxHealth: 5 },
    level3: { minHealth: 2, maxHealth: 7 }
    // ... 更多等级配置
}
```

### 视觉效果参数

```javascript
// 颜色配置
const COLORS = {
    player: '#ffdd00',
    bullet: '#ffff00',
    laser: '#ff0066',
    explosion: '#ff6600',
    shield: '#00ffff'
}

// 动画参数
const ANIMATION = {
    explosionDuration: 20,    // 爆炸动画帧数
    shieldPulse: 10,         // 护盾脉冲频率
    itemRotation: 0.1        // 道具旋转速度
}
```

## 事件系统

### 键盘事件

```javascript
// 监听的按键
const KEY_BINDINGS = {
    'ArrowLeft': 'moveLeft',
    'ArrowRight': 'moveRight',
    'Space': 'startGame',
    'KeyP': 'pauseGame',
    'KeyR': 'restartGame'
}
```

### 触摸事件

```javascript
// 移动端控制
const TOUCH_CONTROLS = {
    leftButton: HTMLElement,   // 左移按钮
    rightButton: HTMLElement,  // 右移按钮
    gameArea: HTMLElement      // 游戏区域
}
```

### 游戏事件

```javascript
// 自定义事件
const GAME_EVENTS = {
    'game:start': '游戏开始',
    'game:end': '游戏结束',
    'player:levelup': '玩家升级',
    'item:pickup': '拾取道具',
    'tile:destroyed': '瓦片被摧毁',
    'weapon:upgrade': '武器升级'
}
```

## 使用示例

### 创建自定义武器

```javascript
// 添加新武器类型
const customWeapon = {
    name: '火箭炮',
    cooldown: 30,
    duration: 300,
    bulletType: 'rocket',
    damage: 10
}

// 在玩家射击方法中处理
case 'rocket':
    bullets.push(new RocketBullet(this.x, this.y))
    break
```

### 自定义瓦片生成

```javascript
// 修改瓦片生成逻辑
function createCustomTilePattern() {
    // 创建特殊图案的瓦片
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === 1) {
            tiles.push(new Tile(x, y, health))
        }
    }
}
```

---

**注意事项：**
- 所有坐标系以左上角为原点
- 角度使用弧度制
- 时间单位为帧数（60FPS）
- 颜色使用十六进制或rgba格式
