# 接手提示词（新对话用）

把下面整段粘贴给新对话：

---

这是我的 H5 游戏项目「瓦片破坏者 Hex Breaker」，请在 `/Volumes/Work/Prive/Hex-Breaker` 工作，继续它的迭代。与用户交流用简体中文；代码、路径、标识符保持原文。先做再总结，改动聚焦。

## 现状（截至 2026-09-16，v2.8.1）

- 线上：https://hex-breaker.pages.dev （Cloudflare Pages，wrangler 已登录）；仓库：https://github.com/ForceMind/Hex-Breaker（master 分支，直接 push）。
- 技术栈：Phaser 3.90 + TypeScript strict + Vite 8 + vitest。竖屏 H5：设计分辨率 540×(960–1200)，DPR 封顶 2，Scale FIT + CSS flex 居中，PC 宽屏时 canvas 圆角+投影呈"手机框"效果（global.css 的 `@media (min-aspect-ratio: 3/4)`）。
- 玩法：八边形瓦片从顶部连续流下，玩家角色底部左右移动自动向上射击；3 命制、每 8 分升 1 级（升级 +2 金币即时到账）、5 武器多持升级、5 种炸弹、回旋镖、20 种道具按等级解锁、战力动态难度（简单→地狱）。三种模式：闯关（30 关含 3 个 BOSS 关，1–3 星评价）、每日挑战（UTC 种子人人同关 + 连续打卡）、无尽（Lv30 后有终局压力）。金币经济（首通 30/重复 10/每日 20/无尽 score÷10 封顶 50/升级 2/模拟充值）、8 套皮肤主题、27 成就、每周模拟排行榜（100 机器人）、PWA + 安装提示。
- 版本演进：v1 单文件 demo（保留为 legacy-tile-breaker.html）→ v2.0 工程化 → v2.1 关卡/每日/飞船 → v2.2 BOSS/金币/主题/排行榜 → v2.3 背身角色 → v2.4 PWA+主题美术全量 AI 化 → v2.5 成就系统（存档升 v5）→ v2.6 模拟充值+基础版回归黄方块+PC 无声修复+ghost 按钮+掉落常显名称 → v2.7 AI 朴素黄方块（.1 修 restart 崩溃、.2 按 v1 截图重绘、.3 射速放慢）→ v2.8 原创音乐音效+高刷屏锁帧（.1 升级发金币+成就列表整行对齐）。
- 测试 139 项全绿；任何改动必须保持 `npm run typecheck && npm test && npm run build` 三绿。

## 架构约定（重要，遵守）

- `src/core/`：纯逻辑零依赖（config.ts 全部数值表、difficulty.ts 难度公式、levels.ts 关卡表、dailyLevel、patterns.ts 13 阵型、itemNames.ts 8×20 道具名表、economy.ts 金币规则、prng.ts、achievements.ts）。数值只许改这里。
- `src/services/`：save.ts（localStorage key `hex-breaker:save`，SAVE_VERSION=5 + migrate；改结构必须升版本写迁移+测试）、audio.ts（Web Audio 全合成，无音频文件；BGM 为原创 16s chiptune 循环——D 小调五声音阶八音盒旋律 + Dm/Bb/F/C 低音脉冲 + 三角波和声垫，120 BPM 步进音序器；音效统一「木质+玻璃」音色集）、vibration.ts、pwa.ts、leaderboard.ts。
- `src/game/`：config/themes.ts（8 主题配色 + sprite/tile/bg key）、config/assets.ts（可选 AI 图清单）、rendering/textures.ts（2x 烘焙白图+setTint）、ui/（Button/Modal/Toast/Toggle/Background/installPrompt/RechargeModal）、scenes/（Boot/Home/LevelSelect/Daily/Game/Help/Settings/Theme/Leaderboard/Achievement）。
- 美术总原则（用户明确要求）：基础版（sky 默认主题）永远保持 v1 朴素黄方块基准；精致 AI 人物/特效一律是金币解锁的付费皮肤；新 UI（成就、充值等）美术跟随当前主题配色。当前 sky 角色 = AI 绘制的朴素黄方块（纯圆角方块+顶部小枪管，无脸无四肢无侧凸——第一版两侧凸起像"脑袋"被用户打回重绘，参考图存 assets-src/ref-v1-player.png）。回退链：主题自己的 sprite → 程序黄块；**任何主题都不回退到 sky 的图**。
- 瓦片按剩余厚度烘焙 1–8 层堆叠（灰色下层错位营造立体）；掉落道具 = 主题色盒 + 图标 + 常显名称标签。这两点是 v1 视觉识别的一部分，迭代时保留。
- 帧计时：1 帧 = 1/60 秒，数值表按帧写。**main.ts 必须保留 `fps: { target: 60, limit: 60 }`**：Phaser 的 `fps.target` 只是平滑目标不限帧，没有 limit 时高刷屏（120Hz+）上 update 每 RAF 都跑，游戏整体 2 倍速以上。
- **Phaser 场景实例跨 `scene.restart()` 复用，字段初始化只跑一次**：所有跨局数组必须在 `init()` 里重置（v2.7.1 事故：`barLabels`/`barTimes` 累积上一局已销毁的 Text，第二局武器条 setText 空指针崩溃）。
- 参考项目 "/Volumes/Work/Prive/Arrow Flow/"（同作者 Phaser 项目）是架构与美术质量标准，可对照阅读，不要抄玩法。

## 关键数值速查

- 默认武器射速 30 帧/发（≈2 发/秒，用户两次要求放慢后的值，别再轻易调快）；连射加成减半。
- SCORE_PER_LEVEL=8；LEVEL_UP_COINS=2；SAVE_VERSION=5。

## 工具与工作流

- 开发：`npm install` 后 `npm run dev` / `npm test` / `npm run typecheck` / `npm run build`。
- 部署：`npm run deploy:cf`（build + wrangler pages deploy dist --project-name hex-breaker）。部署后 curl 验证线上 bundle hash 与 dist 一致（带版本 query 参数绕 SW 缓存）。
- **wrangler / gh 在本机真实环境已登录（凭据在沙盒外长期有效）**：报"未登录 / 需要 CLOUDFLARE_API_TOKEN / 非交互模式"错误时，先直接重试同一命令；仍失败则告知用户在真机终端跑 `npx wrangler login`。不要当成沙盒固有限制，也不要手写 OAuth 刷新脚本（auth.workers.dev 在本机网络不可达）。
- QA：`scripts/qa-validate*.mjs` 用 Playwright 截图验证（通过 createRequire 借用 "/Volumes/Work/Prive/Arrow Flow/package.json" 的 playwright；浏览器二进制在 ~/Library/Caches/ms-playwright/chromium_headless_shell-1243）。qa/ 截图不入库。可用 addInitScript 预置 v5 存档。跑完必须杀干净 vite preview 进程（用 SIGKILL）。已有脚本：9/10（充值+主页）、11（基础版角色+主题商店）、12（再来一局 restart 回归）、13（音频全开）、14（成就页布局）。
- AI 生图：image_generation 插件，transparent PNG；**后处理用 sharp**（createRequire 借 Arrow Flow 的依赖，系统无 PIL）：裁底部 ~10% 去"AI生成"水印 → alpha bbox 裁内容 → 去小连通域噪点 → 缩放（角色/砖块 128px 内）→ public/assets/，原图留 assets-src/。临时脚本放 /tmp 不入库。
- 交付标准：功能做完要浏览器实际截图验证（像素级，不只是 HTTP 200），确认无 JS 报错，然后 commit + push + deploy:cf，CHANGELOG 加条目、package.json 升版本。

## 已知取舍（不要擅自改）

- BOSS 只吃子弹伤害（炸弹/回旋镖只伤护卫）。
- 主题不走热切换，切换后场景 refresh 生效。
- 每日金币仅当天首胜发放；每日失败也算打卡（0 星）。
- 成就系统已完成（27 个），不要重构。
- 模拟充值是明确的"纯模拟"（60/300/680/1280 金币 = ¥6/30/68/128），不接真实支付 SDK。
- 待做候选：关卡内挑战任务（如"不用道具通关"）、BOSS 弹幕攻击、iOS 真机性能与发热观察。
- 仓库卫生：外接卷会产生 `._*` AppleDouble 垃圾文件，.gitignore 已排除，别提交；qa/、.reasonix/、reasonix.toml、临时脚本不入库。

先读 README.md、CHANGELOG.md 和 src/core/config.ts 建立全貌，再听我的新指令。
