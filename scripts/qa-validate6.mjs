// QA 第六轮：BOSS 关 / 主题购买 / 排行榜 / 新主页
import { createRequire } from 'node:module';
const require = createRequire('/Volumes/Work/Prive/Arrow Flow/package.json');
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4199;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SEED_SAVE = JSON.stringify({
  version: 4,
  highScore: 137, bestLevel: 18, gamesPlayed: 5, totalTilesDestroyed: 137,
  settings: { music: true, sound: true, vibration: true },
  campaign: { unlockedLevel: 10, records: { 1: { stars: 3, bestTimeMs: 27900 } } },
  daily: { lastPlayedDate: '', streak: 0, bestStars: 0, bestTimeMs: 0 },
  economy: { coins: 500, totalEarned: 500 },
  selectedTheme: 'sky', unlockedThemes: ['sky'],
});

const server = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE); if (r.ok) return; } catch {}
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
  const pc = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  pc.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  pc.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await pc.addInitScript((save) => localStorage.setItem('hex-breaker:save', save), SEED_SAVE);
  await pc.goto(BASE, { waitUntil: 'networkidle' });
  await pc.waitForSelector('#game canvas', { timeout: 15000 });
  await pc.waitForTimeout(2500);
  await pc.screenshot({ path: OUT + 'v4-1-home.png' });

  // 选关（主页双按钮行 y≈0.567，选关在左 x≈0.35）
  await canvasClick(pc, 0.35, 0.567);
  await pc.waitForTimeout(1500);
  await pc.screenshot({ path: OUT + 'v4-2-levelselect-boss.png' });

  // 点第 10 关（5列6行网格，第 10 关 = 第 2 行第 5 列；网格大致 y 0.13..0.62，先读布局再点）
  // 卡片网格从标题下方开始，按 6 行均分估算：行2 中心 y ≈ 0.245，列5 中心 x ≈ 0.83
  await canvasClick(pc, 0.83, 0.245);
  await pc.waitForTimeout(4000);
  await pc.screenshot({ path: OUT + 'v4-3-boss-fight.png' });
  await pc.waitForTimeout(6000);
  await pc.screenshot({ path: OUT + 'v4-4-boss-fight2.png' });
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(1000);

  // 排行榜（ghost 第一行左：y≈? 主页按钮区改版后 ghost 两行，先试 0.755 行）
  await canvasClick(pc, 0.35, 0.755);
  await pc.waitForTimeout(1500);
  await pc.screenshot({ path: OUT + 'v4-5-leaderboard.png' });
  await canvasClick(pc, 0.5, 0.93);
  await pc.waitForTimeout(1000);

  // 主题（ghost 第一行右）
  await canvasClick(pc, 0.65, 0.755);
  await pc.waitForTimeout(1500);
  await pc.screenshot({ path: OUT + 'v4-6-themes.png' });
  // 买 forest（2×2 网格右上卡 ≈ x0.65 y0.35）
  await canvasClick(pc, 0.65, 0.35);
  await pc.waitForTimeout(1000);
  await pc.screenshot({ path: OUT + 'v4-7-theme-confirm.png' });
  // 确认购买（Modal primary 按钮居中偏下）
  await canvasClick(pc, 0.5, 0.58);
  await pc.waitForTimeout(1200);
  await pc.screenshot({ path: OUT + 'v4-8-theme-bought.png' });

  const coins = await pc.evaluate(() => JSON.parse(localStorage.getItem('hex-breaker:save')).economy.coins);
  const theme = await pc.evaluate(() => JSON.parse(localStorage.getItem('hex-breaker:save')).selectedTheme);
  console.log('COINS_AFTER:', coins, 'THEME:', theme);

  await browser.close();
  console.log('QA6_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
