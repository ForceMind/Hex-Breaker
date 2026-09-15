# 🛠️ 开发指南

本文面向贡献者，介绍 Hex Breaker 2.0 的开发环境、目录约定与常见改动路径。模块接口细节见 [API.md](API.md)，部署见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 环境要求

- **Node.js ≥ 20**（`package.json` 的 `engines` 字段有硬性声明）
- npm（随 Node 自带）

## 安装与常用命令

```bash
npm install        # 安装依赖

npm run dev        # Vite 开发服务器，默认 http://localhost:5173
                   # 端口可用 PORT 环境变量覆盖，已开启 --host 可供手机局域网调试
npm run build      # 先跑 tsc --noEmit 全量类型检查，再构建到 dist/
npm run preview    # 本地预览构建产物
npm test           # vitest run：4 个测试文件，52 个用例
npm run test:watch # vitest 监听模式
npm run typecheck  # 仅类型检查（tsc --noEmit -p tsconfig.json）
```

提交前请至少跑一遍 `npm run typecheck && npm test`。

## 目录约定

```
src/
├── core/          # 纯逻辑层：不 import Phaser，所有数值与公式的唯一来源
├── services/      # 平台服务（save / audio / vibration）：不 import Phaser
├── game/
│   ├── config/    # 布局常量（设计分辨率、调色板、深度层）
│   ├── scenes/    # 五个场景，均继承 BaseScene
│   ├── ui/        # 可复用 UI 组件（Button / Modal / Toast / Toggle / Background）
│   ├── rendering/ # 程序生成贴图
│   └── services.ts# 服务单例组装（createServices / services()）
└── styles/        # 页面级 CSS（游戏画面外的一切）
tests/             # vitest 用例，只测 core 与 services
scripts/           # 一次性 QA 截图脚本（见下文）
qa/                # QA 截图输出目录，不入库
```

几条硬约定：

- **`core/` 与 `services/` 禁止依赖 Phaser**。这两层要在 node 环境下被 vitest 直接加载，任何 `import Phaser` 都会破坏测试。
- **玩法数值只改 `src/core/config.ts` 和 `src/core/difficulty.ts`**，不要在场景里散落魔法数字。
- **所有时间用「帧」表示**（60 fps，1 帧 = 1/60 s），与原版 demo 一致。
- 场景内用 `this.svc`（`BaseScene` 注入）访问存档 / 音频 / 震动，不要 `new` 新实例。

## 常见改动路径

### 新增一种道具

1. `src/core/types.ts`：把新标识加入 `ItemType` 联合类型。
2. `src/core/config.ts`：
   - 在 `ITEM_UNLOCK_TIERS` 的合适等级档里加入该道具（控制解锁时机）；
   - 在 `ITEM_META` 里登记显示名与配色。
3. `src/game/rendering/textures.ts`：在 `itemGlyph()` 里把它归入某个图标族；如需新图标，在 `ensureTextures()` 里烘焙并登记到 `TEX`。
4. `src/game/scenes/GameScene.ts`：在拾取分发（`applyItem` 的 `switch`）里实现效果。
5. 若影响战力，更新 `src/core/difficulty.ts` 的 `calculatePlayerPower` 与 `PowerInput`。
6. 在 `tests/config.test.ts` 补解锁表用例。

### 新增一种阵型

1. `src/core/types.ts`：加入 `PatternType` 联合类型。
2. `src/core/patterns.ts`：
   - 加入 `PATTERN_TYPES` 数组；
   - 在 `generatePattern()` 的 `switch` 里实现布尔掩码生成；
   - 需要随机性时使用注入的 `rng` 参数，**不要直接调 `Math.random`**（保证可测）。
3. `src/core/config.ts`：在 `PATTERN_NAMES` 里登记中文名。
4. 在 `tests/patterns.test.ts` 补用例（可用 `mulberry32(seed)` 注入确定性随机）。

### 调武器 / 炸弹数值

- 武器冷却与时长公式：`config.ts` 的 `weaponBaseCooldown()` / `weaponCooldown()` / `weaponDuration()`；持续时长加成在 `WEAPON_DURATION_BONUS`。
- 炸弹参数：`config.ts` 的 `BOMB_PARAMS` 表（速度 / 爆炸半径 / 伤害 / 方向 / 颜色 / 显示名）。
- 改完务必同步 `tests/config.test.ts` 里对应的期望值。

### 贴图规范

- 所有贴图在 `src/game/rendering/textures.ts` 里用 Graphics API **以 2 倍尺寸**烘焙，key 统一 `hb-` 前缀并登记进 `TEX`。
- 一律画成**白色底图**，显示时用 `setTint()` 上色。tint 是乘法：需要暗部的区域画灰色（如 `0x8a8a8a`），上色后自然成为该颜色的深阶。
- 新贴图在 `ensureTextures()` 里用 `make(key, w, h, draw)` 辅助函数烘焙；该函数幂等，重复调用直接返回。
- 文字一律走 `BaseScene.text()`（自动带 DPR resolution），不要直接 `scene.add.text` 而忘了设 `resolution`。

### 存档字段变更

`SaveData` 有版本号（`SAVE_VERSION`，当前 1）。新增字段时：

1. 更新 `SaveData` 接口与 `defaultSave()`；
2. 更新 `migrate()` 让旧数据平滑升级；
3. 递增 `SAVE_VERSION` 并在 `tests/save.test.ts` 补迁移用例。

## 测试约定

- 框架：vitest，node 环境（`vitest.config.ts`），只测 `core/` 与 `services/`。
- 测试文件放 `tests/*.test.ts`；`._*`、`node_modules`、`dist` 已被排除。
- 涉及随机的逻辑必须可注入 rng（默认参数 `rng = Math.random`），测试用 `mulberry32(seed)` 保证确定性。
- 数值类用例直接断言公式结果，改数值时同步更新期望。

## QA 截图脚本

`scripts/qa-validate.mjs` 及 `qa-validate2/3/4.mjs` 是一次性端到端验证脚本：启动 `vite preview`（端口 4199），用 Playwright 分别在 PC 宽屏（1440×900）与移动竖屏（390×844）下截图到 `qa/`，并检查控制台报错与 localStorage 存档。

```bash
node scripts/qa-validate.mjs
```

**依赖说明（重要）**：这些脚本不在项目依赖内——脚本通过 `createRequire` 从相邻项目 `../Arrow Flow/package.json` 借用 Playwright，并使用本机 `~/Library/Caches/ms-playwright/` 下的 headless Chromium。换机器使用时请：

1. 自行安装 Playwright（`npm i -D playwright && npx playwright install chromium` 或全局安装）；
2. 把脚本顶部的 `createRequire(...)` 路径与 `executablePath` 改为你的实际安装位置。

截图产物在 `qa/`，已被 `.gitignore` 排除，不入库。

## 调试提示

- 移动端真机调试：`npm run dev` 已监听 `0.0.0.0`，手机访问 `http://<电脑 IP>:5173`。
- 存档排错：DevTools → Application → Local Storage → key `hex-breaker:save`。
- 音频无声：检查设置页开关；AudioContext 必须由用户手势解锁，刷新后第一次点击才会出声。
