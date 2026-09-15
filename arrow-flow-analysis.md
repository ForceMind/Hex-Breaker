# Arrow Flow（箭流：突围）项目深度分析报告

> 分析对象：`/Volumes/Work/Prive/Arrow Flow/`（Phaser 3.90 + TypeScript strict + Vite 8）
> 源码规模：src/ 约 9190 行 TypeScript；测试约 2325 行；package version 0.5.1

## 0. 项目一句话概括

纯前端 H5 箭头消除益智游戏：点击箭头让其沿指向飞出棋盘，清空即通关。无后端，进度全部存 localStorage，2000 个离线预生成的主线关卡（40 章 × 50 关），另有每日挑战、无限模式、本地模拟 1v1 排位/约战、模拟排行榜与双货币经济。所有贴图由 Phaser Graphics 程序生成，所有音频由 Web Audio 合成——public/ 里没有任何图片/音频/字体资源文件。

## 1. 整体架构

### 目录划分与职责

```
src/
├── main.ts                 # 入口：创建 Phaser.Game、注册 17 个 scene、全局手势解锁音频
├── vite-env.d.ts
├── core/                   # 纯 TS 逻辑层，零 Phaser/DOM 依赖（可在 Node 中跑生成器/求解器/测试）
│   ├── types.ts            # Level/ArrowDef/GateDef/Direction/ColorId 数据模型
│   ├── directions.ts       # DX/DY 方向表、旋转/镜像、distanceToEdge
│   ├── boardState.ts       # BoardState：occ Int32Array 占用表（0 空 / +k 箭头 / -k 门）
│   ├── rules.ts            # checkRay 射线判定、canRemove/applyRemove/legalMoves/findHint 支撑
│   ├── solver.ts           # 贪心求解器（机制单调 ⇒ 贪心完备）+ computeWaves 分层 + findHint
│   ├── difficulty.ts       # 17 维特征提取 + 加权 0..100 难度分
│   ├── shapes.ts           # 10 种棋盘形状掩码（full/holes/corridor/cross/ring/zones/cluster/border/asym/diamond）
│   ├── prng.ts             # mulberry32 确定性随机 + FNV-1a + combineSeed
│   ├── specialMechanics.ts # 钥匙/门/锁注入（每次插入后用 solver 重验可解）
│   ├── generator.ts        # 反向构造法生成关卡 + 难度自适应拒绝采样
│   ├── campaign.ts         # 章节/难度曲线/kind 分配/每日与无尽的 LevelPlan
│   └── levelCodec.ts       # 单字符棋盘编码 + LevelJson + 8 对称不变 canonical hash
├── data/                   # 静态数据层
│   ├── strings.ts          # 中英双语字符串表 + t()/setLanguage/detectLanguage
│   ├── themes.ts           # 6 套主题（25+ 颜色槽位/主题）
│   ├── tutorialLevels.ts   # 10 个手写教学关（grid 字符串）
│   ├── campaignLoader.ts   # 按章 fetch + 缓存 + 预取（public/levels/*.json）
│   └── levelPack.ts        # 关卡包文件格式类型（ChapterFile/LevelManifest）
├── services/               # 业务服务层（无 Phaser 依赖）
│   ├── saveService.ts      # 存档（localStorage，migrate 到 v3，内存降级）
│   ├── audioService.ts     # 全合成音效 + 生成式背景和弦（Web Audio）
│   ├── vibrationService.ts # 震动（按触摸能力门控）
│   ├── pwaService.ts       # Service Worker 注册 + iOS/Android 安装引导
│   ├── dailyService.ts     # 每日关构建（UTC dateKey → 确定性生成）
│   ├── endlessService.ts   # 无尽模式当前关/推进/按周重置
│   ├── competitionService.ts # 赛季窗口、体力恢复/消耗、门票与奖励阶梯
│   ├── leaderboardService.ts # 100 个种子机器人模拟排行榜
│   ├── battleService.ts    # 本地模拟对战：难度带、对手、计分、Elo 式积分
│   ├── scoreEngine.ts      # 对战计分 reducer（竞速分 + 表现分）
│   └── profileService.ts   # 随机昵称/头像
└── game/                   # Phaser 表现层
    ├── services.ts         # 进程级单例 Services（save/audio/vibration/loader/endless/theme/applySettings）
    ├── config/layout.ts    # 设计分辨率、DPR 上限、DEPTH 层级、字体常量
    ├── scenes/             # 17 个场景（见下）
    ├── ui/                 # Button/Modal/Toast/Toggle/ScrollList/StarRow/CurrencyBadge/AvatarView/Background
    ├── rendering/          # textures.ts（Graphics 程序生成全部贴图）、BoardRenderer、ArrowView、GateView、Effects
    ├── tutorial/TutorialOverlay.ts  # 教学气泡 + 手指指引（不挡输入）
    └── debug/DebugPanel.ts          # ?debug=1 时的 DOM 调试面板
```

### main.ts 启动方式（`src/main.ts`）

- `new Phaser.Game({...})`：`type: Phaser.AUTO`，`parent: 'game'`，`backgroundColor: '#0b1d33'`
- `fps: { forceSetTimeOut: debug, target: 60 }`（debug 时用 setTimeout 保证后台 tab 继续跑，供自动化截图）
- `render: { antialias: false, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' }`
- `audio: { noAudio: true }`——Phaser 声音系统完全不用（避免第二个 AudioContext），全部声音走自研 AudioService
- `input: { activePointers: 3, touch: { capture: true } }`，`disableContextMenu: true`
- registry 写入 `dpr` 和 `designHeight` 两个全局值，供 BaseScene 使用
- 5 种事件（pointerdown/pointerup/touchend/click/keydown）都接 `services.audio.unlock()` 应对 iOS 音频手势限制
- `?debug=1` 开启调试（`window.__arrowFlow = { game, services }`），并跳过 PWA 安装弹窗
- 全局 iOS 双击缩放阻断（touchend 320ms 内第二次 preventDefault + gesturestart 拦截）

### Scene 列表（17 个，注册顺序见 main.ts:63）

| Scene | 作用 |
|---|---|
| BootScene | 启动画面：生成贴图、加载 levels/manifest.json → 按状态进 HomeScene / ProfileScene（首启）/ BattleGameScene（有未完成对局） |
| HomeScene | 主菜单：继续游戏/选关/排行榜/排位/约战/每日/无限/主题/设置，顶角星星+金币徽章 |
| ChapterScene | 章节列表（第 1–20 章卡片，ScrollList 滚动） |
| ChapterBookScene | "进阶章节书"（第 21–40 章，左右翻页） |
| LevelSelectScene | 单章 50 关 5×10 网格，星数/锁/挑战关角标，支持左右滑切章 |
| GameScene | 核心玩法场景（728 行，全项目最大文件），支持 campaign/daily/endless 三种 GameMode |
| DailyScene | 每日挑战大厅（免费 1 次 + 金币重试阶梯） |
| EndlessScene | 无尽模式大厅（体力 5、购买恢复） |
| RankedScene | 排位大厅（积分、战绩） |
| ChallengeScene | 约战大厅（6 档星星门票） |
| MatchmakingScene | 模拟匹配流程（搜索→确认→3-2-1 倒计时） |
| BattleGameScene | 对战对局场景（双比分、每 3 秒对手快照） |
| ProfileScene | 昵称/头像（首次启动强制配置） |
| LeaderboardScene | 三榜：每日榜/周榜/通关榜 + 结算领金豆 |
| BeanExchangeScene | 金豆→金币兑换（20→40 / 50→110 / 100→240） |
| ThemeScene | 6 套主题选择与预览 |
| SettingsScene | 音乐/音效/震动/教学/语言开关、模拟充值、重置进度 |

所有场景继承 `BaseScene`（`src/game/scenes/BaseScene.ts`）：统一相机 `setZoom(dpr)` + `centerOn(W/2, H/2)`、主题读取、`text()` 高清文字工厂、`go()` 黑场转场、`refresh()` 无黑场原地重启（registry `__skipFadeIn` 标记）。

## 2. index.html 与 PC 端"居中竖屏框架"（重点）

### index.html（22 行，极简）

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#a9d4f5" />
...
<body>
  <div id="app">
    <div id="game"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

### 外层布局 CSS（`src/styles/global.css`）——"手机壳"是 CSS 纯居中卡片方案

**没有图片式手机边框**。做法是：页面铺满深蓝底 + 暗角渐变，canvas 以竖屏比例居中，宽屏（PC）下给 canvas 加圆角和投影，视觉上像一台居中的手机：

```css
:root { --bg: #0b1d33; }
html, body { margin:0; width:100%; height:100%; overflow:hidden;
  background: var(--bg); touch-action: none; overscroll-behavior: none; ... }

#app {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  padding-top: env(safe-area-inset-top, 0px);    /* 四向刘海安全区 */
  ...
  background:
    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05), transparent 40%),
    var(--bg);                                    /* 深蓝 #0b1d33 + 两团微光 */
}

#game { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

#game canvas { display: block; border-radius: 0; box-shadow: 0 0 0 1px rgba(255,255,255,0.06); }

/* 宽屏（宽高比 ≥ 3:4，即 PC/平板横屏）时给 canvas 圆角 + 深投影 → 竖屏卡片感 */
@media (min-aspect-ratio: 3/4) {
  #game canvas {
    border-radius: 18px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  }
}
```

### Phaser Scale 配置（`src/main.ts:32-44`）

```ts
const dpr = devicePixelRatioCapped();                        // min(max(dpr,1),2)，封顶 2
const designHeight = computeDesignHeight(window.innerWidth, window.innerHeight);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1d33',
  width:  DESIGN_WIDTH * dpr,       // 540 * dpr
  height: designHeight * dpr,       // 960..1200 之间 * dpr
  scale: {
    mode: Phaser.Scale.FIT,         // 等比缩放、完整放进容器（竖屏留两侧/上下空隙由 CSS 背景兜住）
    autoCenter: Phaser.Scale.NO_CENTER,  // 居中交给 CSS flex，不用 Phaser 的 center
  },
  ...
});
```

### 设计分辨率（`src/game/config/layout.ts`）

```ts
export const DESIGN_WIDTH = 540;          // 逻辑宽度固定 540 pt
export const MIN_DESIGN_HEIGHT = 960;     // 高度随视口比例自适应
export const MAX_DESIGN_HEIGHT = 1200;    // 最低 960（16:9 竖屏）最高 1200（瘦长屏）
export const MAX_DPR = 2;                 // 3x/4x 手机不多渲染像素
export const MAX_CELL_SIZE = 96;
export const MIN_CELL_SIZE = 30;

export function computeDesignHeight(vw: number, vh: number): number {
  const aspect = vh / Math.max(1, vw);
  const h = Math.round(DESIGN_WIDTH * aspect);
  return Math.max(MIN_DESIGN_HEIGHT, Math.min(MAX_DESIGN_HEIGHT, h));
}
```

即**设计分辨率 = 540 × (960~1200)**，竖屏；横屏/PC 视口下 aspect<1 会被夹到 960，canvas 保持 540×960 竖屏比例 FIT 缩放居中。每个 BaseScene 相机 `setZoom(dpr)` + `centerOn(270, H/2)`，逻辑坐标始终用设计单位写。

## 3. 核心玩法机制

- **棋盘**：宽 4~12、高 4~16 的网格（战役最大 12×16），格子上是带方向的箭头瓦片，可能有门（gate）。
- **点击飞出**：点一个箭头，它沿自身方向（^ > v <）直线飞出棋盘。判定是 `checkRay`：从该格沿方向走到棋盘边，**路径上存在任何未移除箭头或关闭的门 ⇒ 被挡；空格不阻挡，路径可任意长**。
- **通关**：清空全部箭头（`BoardState.isCleared()`，remaining===0）。
- **失误**：点被挡的箭头不计移除，播弹回动画 + 镜头震 90ms + 失误+1。每章第 50 关为挑战关，`CHALLENGE_MAX_MISTAKES = 3` 次失误上限，超限失败；普通/迷你/教学关无失误上限（`maxMistakes: null`）。无尽模式每次失误再扣 1 点体力，体力尽则本轮结束。
- **无时间限制**；用时只参与计分/纪录。连击：两次成功间隔 ≤ `COMBO_WINDOW_MS = 800`ms 累积，5/10/20 连击有里程碑音效特效。
- **特殊机制**（`ColorId` 0|1|2，最多 3 色）：
  - **钥匙箭头**：飞出后打开全场同色所有门（门关闭时视同阻挡物）。
  - **锁定箭头**：同色钥匙未被移除前不可点击（点击只提示，不算失误）。
  - **锁定钥匙**（lockedKeys，第 33 章后 multi 阶段）：一把钥匙本身被上一色锁住，形成钥匙链。
- **星评**（`computeStars`）：0 失误 0 提示 = 3 星；≤2 失误且 ≤1 提示 = 2 星；其余 1 星。
- **提示**：`solver.findHint` 从合法着法中挑"射线长+靠内部"的箭头高亮 1200ms。
- **可解性保证**：所有机制单调（移除箭头不会挡别人、钥匙只开不关），所以贪心求解器是完备判定器；生成器每关都过 solver 验证。

### 模式

| 模式 | 关卡来源 | 限制 |
|---|---|---|
| 战役 campaign | public/levels 预生成，2000 关 | 挑战关 3 失误上限；免费重玩 |
| 每日 daily | UTC 日期作种子本地生成（人人同关），目标难度 70–90 | 每期 1 次免费 + 5 次金币重试（20/30/40/50/60） |
| 无尽 endless | 按周种子序列生成，中/难/超难按 45%/35%/20% 混合 | 体力 5（开局 -1、失误 -1，6 小时回 1 点） |
| 排位/约战 battle | 专用生成器按难度带生成（排位 50–94、约战门票 72–94） | 排位 Elo 式 ±分；约战押星星门票赢双倍 |

## 4. 系统层（`src/services/`）

### 存档 saveService.ts（522 行，第二大文件）

- **localStorage key：`'arrow-flow:save'`**（`SAVE_KEY`），整个存档一个 JSON；另有 PWA 的 `'arrow-flow:install-auto-prompt-shown'`。探测 key `'__arrow_flow_probe__'` 用于检测 localStorage 可用性，不可用降级为内存 Map。
- 版本 `SAVE_VERSION = 3`，`migrate()` 把任意历史/损坏数据清洗到当前结构（v0 的 `progress.level`、v1 的纯累计星 → 补发 availableStars、v<3 按通关数补金币）。
- `SaveData` 结构：
  ```
  version, unlockedLevel, levelRecords: Record<"关号", {stars,bestMistakes,bestTimeMs,hintUsed,completions}>,
  totalStars, selectedTheme, unlockedThemes[],
  settings: {music,sound,vibration,tutorial,language:'auto'|'zh'|'en'},
  daily: {lastCompletedDate, streak, records: Record<"YYYY-MM-DD",{stars,mistakes,timeMs,hints,score}>, attempts, settledPeriods[], claimedPeriods[]},
  endless: {currentIndex, bestIndex, currentSeed, currentSalt, lives, lifeUpdatedAt, purchasedDay, purchasedLives, weekly, weekKey},
  tutorial: {baseCompleted, keyGateCompleted, lockCompleted, seenSteps[]},
  battle: {availableStars, rating(=1000 起), rankedWins/Losses, challengeWins/Losses, activeMatch, settledMatchIds[]},
  profile: {nickname, avatarId, configured},
  economy: {coins(初始60), beans, ledger[]}
  ```
- 核心 API：`get/update/mutator/save/reset/onChange`、`recordCampaignResult`（只更优覆盖）、`recordDailyResult`、`computeStars`、`awardOnce(key,...)`（ledger 幂等发奖）、`spendCoins/spendBeans/addCoins`、`spendEndlessLife`、`settleBattleOnce`、`setProfile`、`unlockTheme`。

### 货币与经济（competitionService.ts / BeanExchangeScene）

- **金币 coins**：初始 60；首通关按难度 +2~5，升星 +1/+1，章节全通 +20~55，每日首通 +10；设置页"模拟充值 $2 → +200"（纯本地假支付三步流程）。消耗：每日重试、无尽体力（1 点 15、满格 28–55）。
- **金豆 beans**：仅排行榜结算产出（日榜第 1 给 40、周榜第 1 给 180，阶梯到 100 名外），在 BeanExchangeScene 按比例换金币。
- **星星双轨**：`totalStars`（生涯累计，主题解锁唯一依据，永不扣）与 `battle.availableStars`（可消费钱包，约战门票 5/10/15/20/30/50）。

### 成就/解锁

无独立成就系统；进程度量 = 星数解锁主题（30/90/180/300/450 星）+ 门票档位按生涯星解锁（100/250/500/800）。

### 每日挑战（dailyService.ts + competitionService.ts）

- `dailyDateKey` 用 UTC `YYYY-MM-DD`；种子 `combineSeed('daily', GENERATOR_VERSION, dateKey)`，本地即时生成（带 20 次加盐重试），人人同关。
- 竞赛窗口按**本地时间中午 12:00 开新期、次日 11:30 封榜结算**；`dailyRetryCost = [0,20,30,40,50,60]`。

### 排行榜（leaderboardService.ts）

- 纯本地模拟：`LEADERBOARD_BOTS = 100` 个机器人，由 `combineSeed('leaderboard', 2, kind, periodKey)` 决定，成绩分布按幂律偏向中段、绝不按玩家成绩缩放（注释明确说明这是设计原则）。
- `buildLeaderboard(kind: 'daily'|'endless'|'base', periodKey, player, reference?)`：玩家真实成绩插入排序，按 primary → timeMs → mistakes 排。

### 音效（audioService.ts，244 行）

- 全部 Web Audio 合成，零音频文件；懒加载 AudioContext，首次用户手势 `unlock()`；iOS 'interrupted' 状态恢复处理。
- 音效 API：`tap/button/fly(combo 音高随连击升)/error/locked/comboMilestone(n)/key/gate/unlockChain/win/fail/hint`，外加 `noise()`（白噪+低通）。
- 音乐：生成式和弦垫循环，4 个和弦每 3 秒一切换 + 稀疏琶音，`musicGain` 0.12。
- `suspend()/resume()` 挂到 Phaser HIDDEN/VISIBLE 事件。

### 设置（saveService.settings + SettingsScene）

music / sound / vibration / tutorial / language（auto 时按 `navigator.language` 判中文）；改动统一走 `save.update` + `services.applySettings()`。

### 皮肤/主题（data/themes.ts）

6 套：`sky(0)`、`forest(30)`、`sunset(90)`、`ocean(180)`、`neon(300)`、`gold(450)` 星解锁。每主题 25 个颜色槽（bgTop/bgBottom/decor/boardBg/cellEmpty/tile/arrow/accent/button/panel/star/danger/groups[3]/particles[] 等）。`themeById/isThemeUnlocked/css()`。

### 其他服务

- `vibrationService.ts`：`tap 15ms / error [30,40,30] / win [20,60,20,60,40]`；要求 `navigator.vibrate` 存在**且** `maxTouchPoints>0`。
- `pwaService.ts`：注册 `sw.js`；iOS Safari 弹"分享→加主屏"引导，Android Chrome 拦 `beforeinstallprompt` 弹自定义邀请；微信/QQ/UC 等内嵌浏览器明确不弹。
- `battleService.ts`（430 行）+ `scoreEngine.ts`：本地模拟对战。`createBattleLaunch`（难度带→生成验证过的关→种子对手）、`LocalBattleSession`（对手按 solver 顺序推进，每 `BATTLE_SNAPSHOT_MS=3000`ms 快照，46% 窗口"尾随玩家"限速）、`ratingDelta`（胜 +5~8 / 负 -1~3 的 Elo 期望变体）、`scoreProfile`（竞速分 arrowValue≈82+难度×1.05 ×箭数 + 表现分扣失误/提示/超时）。
- `endlessService.ts`：当前关按（runIndex, salt, weekKey）确定性生成；`advance()` 推进；每周一 12:00 重置序列。

## 5. UI 组件库（`src/game/ui/`，9 个）

| 组件 | 接口要点 |
|---|---|
| **Button.ts** | `new Button(scene, x, y, { width?, height?, label?, icon?, variant: 'primary'\|'secondary'\|'ghost'\|'danger', fontSize?, fill?, textColor?, enabled?, silent?, onClick })`。Graphics 画圆角底+高光，按下缩 0.94、松手回弹；**位移 >14px 不触发点击**（滚动列表防误触）。方法 `setLabel/setIcon/setEnabled/setFill`。 |
| **Modal.ts** | `new Modal(scene, designW, designH, { width=440, height=420, title?, closeOnOverlay?, onClose?, depth? })`；遮罩 0.6 透明 + 居中圆角面板（内容加到 `modal.panel`，坐标相对面板中心）；`close(onDone?)` 播缩小动画后销毁。 |
| **Toast.ts** | `showToast(scene, x, y, message, duration=1400)`；同场景只保留一个（name='toast' 先销毁旧的），上浮淡入→停留→上飘淡出。 |
| **Toggle.ts** | `new Toggle(scene, x, y, { value, onChange })`；iOS 风格 72×40 药丸开关， knob tween。 |
| **ScrollList.ts** | `new ScrollList(scene, x, y, width, height)`；子节点加进 `list.content`，几何 mask 裁剪；场景级 pointer 监听 + 惯性（velocity×0.92）+ 鼠标滚轮；`setContentHeight/scrollTo`。 |
| **StarRow.ts** | `new StarRow(scene, x, y, earned, size=24, gap=6)`；`animate(earned, onStar)` 逐颗弹出。 |
| **CurrencyBadge.ts** | `createCurrencyBadge(scene, x, y, icon, tint, value, align='right', width=120, onTap?)`；顶角药丸（图标圆+数值），可点（如金豆徽标→兑换页）。 |
| **AvatarView.ts** | `new AvatarView(scene, x, y, avatarId, size=64, { ring?, alpha? })`；6 种头像各配不同图标+主题色（考虑色弱辨识）。 |
| **Background.ts** | `new Background(scene, W, H, colors)`；36 条竖向渐变带 + 5 个缓动漂移的 softCircle 装饰。 |

所有组件通过 `services().theme().colors` 取主题色，文字统一 `FONT_FAMILY` + `resolution: dpr` 保证高清。

## 6. 关卡系统

### 生成/存储管线

- **离线生成**：`npm run generate:levels` → `scripts/generate-levels.ts`（tsx 跑 Node）产出 `public/levels/chapter-01.json … chapter-40.json` + `manifest.json`（共约 752 KB）。完全确定性：同 GENERATOR_VERSION（当前 1）+ 种子 ⇒ 同样输出。
- **运行时加载**：`CampaignLoader` 只 fetch manifest + 按需取整章（50 关/文件），`getLevel(index)` 内存缓存，过关到 position≥45 时预取下一章。
- **校验**：`scripts/validate-levels.ts` 独立重算（不信任生成器输出）：可解性、hash、重复（exact + canonical）、章节/机制/教程位置。

### levelCodec 编码（`src/core/levelCodec.ts`）

一格一字符，一行一字符串：

```
.        空
^ > v <  普通箭头
A-L      钥匙箭头（color*4+dir，12 个字母 = 3 色 × 4 向）
a-l      锁定箭头
M-Z m-x  被锁的钥匙（key/lock 颜色对 *4+dir）
1 2 3    三色门
```

`LevelJson` 短字段：`{id, i:index, s:seed, v:generatorVersion, w, h, g:行串数组, k:kind, d:difficulty, m:maxMistakes, x:hash, t:tutorialStep}`。hash = 棋盘在 8 个对称变换下字典序最小网格串的 FNV-1a（8 位 hex），用于全局去重。

### campaign 结构与难度曲线（`src/core/campaign.ts`）

- `CHAPTER_COUNT=40`、`LEVELS_PER_CHAPTER=50`、`TOTAL_LEVELS=2000`、`TUTORIAL_LEVEL_COUNT=10`；关卡 id 形如 `c01-05`。
- **kind 分配**：1–10 关 tutorial；每章第 50 关 challenge（3 失误上限）；位置 %10==0 为 mini（小bonus关 +7 难度）；其余 normal。
- **难度带 GROUPS**（8 组）：章 1 → 5–20（4×4/5×5）；2–5 → 10–30；6–10 → 20–40；11–16 → 30–55；17–24 → 40–65；25–32 → 55–80；33–38 → 65–90；39–40 → 75–100（12×14/12×16）。
- **目标难度 = 波形曲线** `targetDifficulty(index)`：组内按章+位置线性插值后乘 `(0.2+0.65·frac)`，每 10 关一个小波（±3，q=3/7 降 5 做"休息关"），mini +7、challenge +12。
- **机制投放**：章 1–5 classic（无机制）、6–14 key、15–24 lock、25–32 combo、33–40 multi（3 色+锁定钥匙）；每章 ≤40% 位置带机制；教学点固定在 **L251（钥匙）和 L701（锁）**。
- **生成算法**（`generator.ts`）：**反向构造**——按"合法移除顺序的逆序"摆箭头（每个新箭头需对已摆箭头有通畅出边，后摆的可以挡它）；形状掩码定可用格、chainBias 控依赖链深度；然后 `injectMechanics` 加钥匙/门/锁（每步 solver 重验）；再按 `targetDifficulty` 拒绝采样（tolerance 5，每 6 次尝试放宽 2，最多 80 次），超难自动加密度/链深、超易反之。
- **难度分**（`difficulty.ts`）：17 维特征（面积对数项 0.22 + 箭数项 0.22 + 初始合法率 0.08 + 中位合法率 0.08 + 依赖深度 0.12+0.06 + 射线长 0.06 + 阻挡 0.08 + 方向熵 0.02 + 机制 0.08 − 单选惩罚），×1.18 拉伸到 0–100；教程板约 5–15，12×16 三色板约 90–100。

## 7. 测试与工程化

- **单测**（vitest，node 环境，`tests/` 共 2325 行）：
  - `rules.test.ts`（122 行）射线/阻挡/锁/钥匙副作用
  - `solver.test.ts`（98）可解判定、waves、findHint、全部教学关可解
  - `codec.test.ts`（80）全部格类型编解码往返、字符唯一、hash 对称不变
  - `generator.test.ts`（161）确定性、可解性、机制注入、难度自适应、计划函数
  - `difficulty.test.ts`（44）小板低分/大板高分、特征提取
  - `saveService.test.ts`（160）迁移、持久化、幂等发奖、体力
  - `battleService.test.ts`（193）计分上限、门票解锁、难度带、积分增减、对战会话
  - `competitionService.test.ts`（98）赛季窗口、体力恢复计时锚点、奖励阶梯
- **CI**：`.github/workflows/deploy.yml`：push main → `npm ci && npm run test && npm run validate:levels && npm run build`（BASE_PATH=/仓库名/）→ GitHub Pages。另有 `npm run deploy:cf`（wrangler pages deploy dist，Cloudflare Pages）。
- **vite.config.ts**：`base` 取 `BASE_PATH` 环境变量（默认 '/'）；`define.__APP_VERSION__` 注入 package.json version；`build.target es2019`；`manualChunks` 把 phaser 单独分包；dev server `host:true port 5173`。
- **tsconfig**：strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride`（很严）；ES2022 target。
- **eslint**：tseslint recommended + `consistent-type-imports`。
- **PWA**：`public/manifest.webmanifest`（standalone、theme_color #a9d4f5）+ `public/sw.js`：缓存名 `arrow-flow-v0.5.1`；`/assets/` 下带 hash 的构建产物 cache-first，**其余一切（含 levels/*.json）network-first + 缓存兜底离线**（避免关卡更新被旧缓存卡住）。
- **QA 脚本**（Playwright，`scripts/`）：`qa-screenshots.mjs`（555 行，全屏遍历截图）、`qa-touch.mjs`（607 行，真实指针事件触屏 QA）、`qa-pwa.mjs`、`qa-battle.mjs`；debug 模式（`?debug=1`）暴露 `window.__arrowFlow` 供驱动。
- **依赖**：运行时只有 `phaser ^3.90.0`；dev：vite 8 / typescript 6 / vitest 4 / playwright / tsx / wrangler / eslint 10。Node ≥20。

## 8. 视觉风格

- **配色**：默认 sky 主题是浅色柔和马卡龙风——背景 `#dff1ff → #a9d4f5` 竖向渐变，白色圆角瓦片 + 蓝色箭头 `#2b6cb0`，主色 accent `#3b82f6`，星 `#ffb703`，危险 `#e63946`，三组机制色 琥珀 `#f59e0b` / 紫 `#8b5cf6` / 绿 `#10b981`。页面兜底色（canvas 外）固定深蓝 `#0b1d33`。另有 forest/sunset/ocean(深色)/neon(深色霓虹)/gold(黑金) 五套。
- **贴图**：`rendering/textures.ts`（437 行）用 Graphics API 程序生成全部 20+ 张贴图（tile/tileTop/tileGlow/arrow/key/lock/chain/gate/gateBars/marker0-2/particle/spark/star/ring/hand/softCircle + 26 个 ICON），**统一画白色再 setTint 上色**，按 2 倍尺寸生成保证高分屏清晰。棋盘背景+空格一次性烘焙成单张 Image（避免每帧重 tessellate Graphics）。
- **字体**：无字体文件，系统栈 `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif`；Text 统一 `resolution: dpr`。
- **设计基准**：540 × 960–1200（见 §2）；DEEPH 层级：background -10 / board 0 / arrows 10 / flying 20 / effects 30 / hud 40 / tutorial 50 / modal 60 / toast 70。GameScene 棋盘区 `{x:16, y:214, w:W-32, h:H-334}`，格子尺寸 clamp(30, 96)。
- **动画语言**： quad/back 缓动的缩放反馈、飞出 Cubic.easeIn + 拖尾粒子、胜利 confetti、星星逐颗 Back.easeOut 弹出。

## 9. public/ 目录内容

```
public/
├── icons/icon.svg          # 唯一图片资源：283 字节的 SVG 应用图标（蓝底白箭头）
├── levels/                 # 752 KB 关卡数据
│   ├── manifest.json       # packVersion fd6f8e0a、2000 关、每章 band/难度 min/max/median/机制统计
│   └── chapter-01.json … chapter-40.json   # 各 50 关 LevelJson
├── manifest.webmanifest    # PWA manifest（standalone、icons/icon.svg、theme #a9d4f5、bg #0b1d33）
└── sw.js                   # Service Worker（见 §7）
```

**没有任何位图、音频、字体文件**——视觉全部程序生成，音频全部合成。index.html 里连 favicon 都是内联 data: SVG。

## 附：值得注意的工程细节

- 存档/排行榜/对战全部本地模拟，代码注释明确写了设计原则（机器人成绩绝不随玩家缩放等）。
- Button/ArrowView/Toggle 的 hitArea 都用**左上角锚定的 (0,0,w,h)**（Phaser Container 命中测试会加 displayOrigin，居中会打偏），注释里专门说明。
- `?debug=1`：DebugPanel + `window.__arrowFlow`，fps 改 setTimeout 驱动，跳过 PWA 弹窗。
- 已知限制见仓库根 `README.md`（38 KB，内容经核实与代码一致）与 `REVIEW-FIX-PLAN.md`。
