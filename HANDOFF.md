# 接手提示词（新对话用）

把下面整段粘贴给新对话：

---

这是我的 H5 游戏项目「瓦片破坏者 Hex Breaker」，请在 `/Volumes/Work/Prive/Hex-Breaker` 工作，继续它的迭代。

## 现状（截至 2026-09-16，v2.4.0）

- 线上：https://hex-breaker.pages.dev （Cloudflare Pages，wrangler 已登录）；仓库：https://github.com/ForceMind/Hex-Breaker（master 分支，直接 push）。
- 技术栈：Phaser 3.90 + TypeScript strict + Vite 8 + vitest。竖屏 H5：设计分辨率 540×(960–1200)，DPR 封顶 2，Scale FIT + CSS flex 居中，PC 宽屏时 canvas 圆角+投影呈"手机框"效果（global.css 的 `@media (min-aspect-ratio: 3/4)`）。
- 玩法：八边形瓦片从顶部连续流下，玩家角色底部左右移动自动向上射击；3 命制、每 8 分升 1 级、5 武器多持升级、5 种炸弹、回旋镖、20 种道具按等级解锁、战力动态难度（简单→地狱）。三种模式：闯关（30 关含 3 个 BOSS 关，1–3 星评价）、每日挑战（UTC 种子人人同关 + 连续打卡）、无尽（Lv30 后有终局压力）。金币经济（首通 30/重复 10/每日 20/无尽 score÷10 封顶 50）、8 套 AI 生成皮肤主题（角色背身 sprite + 独立砖块图 + 背景图 + 全部道具按主题改名）、每周模拟排行榜（100 机器人，幂律分布不随玩家缩放）、PWA + 安装提示。
- 版本演进：v1 单文件 demo（保留为 legacy-tile-breaker.html）→ v2.0 工程化重构 → v2.1 关卡/每日/飞船 → v2.2 BOSS/金币/主题/排行榜 → v2.3 背身角色+关卡加长（L1=46 杀）→ v2.4 PWA+主题美术全量 AI 化。
- 测试 121 项全绿；任何改动必须保持 `npm run typecheck && npm test && npm run build` 三绿。

## 架构约定（重要，遵守）

- `src/core/`：纯逻辑零依赖（config.ts 全部数值表、difficulty.ts 难度公式、levels.ts 关卡表、dailyLevel、patterns.ts 13 阵型、itemNames.ts 8×20 道具名表、economy.ts 金币规则、prng.ts）。数值只许改这里。
- `src/services/`：save.ts（localStorage key `hex-breaker:save`，SAVE_VERSION=4 + migrate；改结构必须升版本写迁移+测试）、audio.ts（Web Audio 合成，无音频文件）、vibration.ts、pwa.ts、leaderboard.ts。
- `src/game/`：config/themes.ts（8 主题含配色+sprite+tile+bg key）、config/assets.ts（24 张可选 AI 图清单）、rendering/textures.ts（2x 烘焙白图+setTint）、ui/（Button/Modal/Toast/Toggle/Background/installPrompt）、scenes/（Boot/Home/LevelSelect/Daily/Game/Help/Settings/Theme/Leaderboard）。
- 美术回退链：角色图（主题→sky→procedural 黄块）；砖块/背景（缺则整套 procedural，不跨主题混搭）。所有 AI 图经 BootScene 加载、loaderror 容错。
- 帧计时：1 帧 = 1/60 秒，数值表按帧写。
- 参考项目 "/Volumes/Work/Prive/Arrow Flow/"（同作者 Phaser 项目）是架构与美术质量标准，可对照阅读，不要抄玩法。

## 工具与工作流

- 开发：`npm install` 后 `npm run dev` / `npm test` / `npm run typecheck` / `npm run build`。
- 部署：`npm run deploy:cf`（build + wrangler pages deploy dist --project-name hex-breaker）。部署后 curl 验证线上 bundle hash 与 dist 一致。注意 SW 缓存：线上验证要带版本参数或刷新两次。
- QA：`scripts/qa-validate*.mjs` 用 Playwright 截图验证（通过 createRequire 借用 "/Volumes/Work/Prive/Arrow Flow/package.json" 的 playwright；浏览器二进制在 ~/Library/Caches/ms-playwright/chromium_headless_shell-1243）。qa/ 截图不入库。可用 addInitScript 预置 localStorage 存档跳过解锁限制。跑完必须杀干净 vite preview 进程（用 SIGKILL，npm 包装进程不会传导 SIGTERM）。
- AI 生图：image_generation 插件（/Users/wxx110/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home/plugins/managed/image_generation），transparent PNG 背景；生成后用 PIL 裁掉左下"AI生成"水印（裁底部 ~10% 再 alpha bbox）+ 去小连通域噪点 + 缩放（角色/砖块 128px）入 public/assets/，原图留 assets-src/。
- 交付标准：功能做完要浏览器实际截图验证（ canvas 像素级检查，不只是 HTTP 200），确认无 JS 报错，然后 commit + push + deploy:cf，CHANGELOG 加条目、package.json 升版本。

## 已知取舍 / 待办想法

- BOSS 只吃子弹伤害（炸弹/回旋镖只伤护卫），是设计取舍可改。
- 主题不走热切换，切换后场景 refresh 生效。
- 每日金币仅当天首胜发放；每日失败也算打卡（0 星）。
- 待做候选：成就系统、关卡内挑战任务（如"不用道具通关"）、BOSS 弹幕攻击、iOS 真机性能与发热观察。
- 仓库卫生：外接卷会产生 `._*` AppleDouble 垃圾文件，.gitignore 已排除，别提交。

先读 README.md、CHANGELOG.md 和 src/core/config.ts 建立全貌，再听我的新指令。
