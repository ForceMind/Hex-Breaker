// QA 第六轮补 2：确认购买森林主题
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
  version: 4, highScore: 137, bestLevel: 18, gamesPlayed: 5, totalTilesDestroyed: 137,
  settings: { music: true, sound: true, vibration: true },
  campaign: { unlockedLevel: 10, records: {} },
  daily: { lastPlayedDate: '', streak: 0, bestStars: 0, bestTimeMs: 0 },
  economy: { coins: 500, totalEarned: 500 },
  selectedTheme: 'sky', unlockedThemes: ['sky'],
});

const server = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore',
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
  await pc.waitForTimeout(2200);
  await canvasClick(pc, 0.65, 0.728);   // 主题
  await pc.waitForTimeout(1200);
  await canvasClick(pc, 0.68, 0.36);    // 森林卡
  await pc.waitForTimeout(900);
  await canvasClick(pc, 0.5, 0.54);     // 支付按钮
  await pc.waitForTimeout(1200);
  console.log('SAVE:', await pc.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('hex-breaker:save'));
    return `coins=${s.economy.coins} theme=${s.selectedTheme} unlocked=${s.unlockedThemes.join('/')}`;
  }));
  await pc.screenshot({ path: OUT + 'v4-13-theme-applied.png' });
  // 回主页看森林主题
  await canvasClick(pc, 0.5, 0.93);
  await pc.waitForTimeout(1500);
  await pc.screenshot({ path: OUT + 'v4-14-home-forest.png' });
  await browser.close();
  console.log('QA6C_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
