// QA 第九轮：v2.5.0 成就系统——主页入口 / 成就列表页（含已解锁+未解锁混合态）/ 无尽结算解锁成就
import { createRequire } from 'node:module';
const require = createRequire('/Volumes/Work/Prive/Arrow Flow/package.json');
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4199;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// v5 save with some progress so several achievements are already unlocked.
const save = JSON.stringify({
  version: 5,
  highScore: 137,
  bestLevel: 18,
  gamesPlayed: 12,
  totalTilesDestroyed: 137,
  settings: { music: false, sound: false, vibration: false },
  campaign: { unlockedLevel: 3, records: { 1: { stars: 3, bestTimeMs: 61000 }, 2: { stars: 2, bestTimeMs: 58000 } } },
  daily: { lastPlayedDate: '', streak: 3, bestStars: 0, bestTimeMs: 0 },
  economy: { coins: 600, totalEarned: 600 },
  selectedTheme: 'sky',
  unlockedThemes: ['sky', 'forest'],
  achievements: { 'tiles-100': 1726000000000, 'games-10': 1726000000000, 'daily-streak-3': 1726000000000 },
});

const server = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start');
}
async function canvasClick(page, fx, fy) {
  const box = await page.locator('#game canvas').boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

const errors = [];
try {
  await waitServer();
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });

  // --- 主页 + 成就入口 + 成就页（部分已解锁） ---
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.addInitScript((s) => localStorage.setItem('hex-breaker:save', s), save);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#game canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}v7-home.png` });

  // 成就按钮在 startY+300 行左侧：startY=432(900 高视口 H≈1200? 实际按 540x(960-1200) FIT)
  // 用文本定位更稳：逐帧尝试找按钮——这里直接按比例点击（幽灵按钮行在无尽模式下方）。
  // 主页按钮顺序: 继续闯关(~0.36H) / 选关+每日(~0.44H) / 无尽(~0.5H) / 排行+主题(~0.57H) / 成就+玩法说明(~0.62H) / 设置(~0.66H)
  await canvasClick(page, 0.36, 0.63); // 成就（左列）
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}v7-achievements.png` });

  // 滚动列表看底部成就
  const box = await page.locator('#game canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}v7-achievements-scrolled.png` });

  // 返回主页
  await canvasClick(page, 0.5, 0.94); // 返回主页按钮
  await page.waitForTimeout(900);

  // --- 无尽模式快速结算：直接开一局无尽，撞死三次出结算面板 ---
  await canvasClick(page, 0.5, 0.5); // 无尽模式
  await page.waitForTimeout(2500);
  // 不移动角色，瓦片会撞上来；等 3 条命耗完（约 30-60s，跳过太久则截当前状态）
  await page.waitForTimeout(45000);
  await page.screenshot({ path: `${OUT}v7-endless-over.png` });

  await page.close();
  await browser.close();
  console.log('QA9_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exitCode = 2;
}
