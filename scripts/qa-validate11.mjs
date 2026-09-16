// QA 第十一轮：v2.7.0——基础版 sky 接入朴素 AI 黄方块（游戏内 + 主题商店预览）
import { createRequire } from 'node:module';
const require = createRequire('/Volumes/Work/Prive/Arrow Flow/package.json');
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4199;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const save = JSON.stringify({
  version: 5, highScore: 137, bestLevel: 18, gamesPlayed: 12, totalTilesDestroyed: 400,
  settings: { music: false, sound: false, vibration: false },
  campaign: { unlockedLevel: 3, records: {} },
  daily: { lastPlayedDate: '', streak: 3, bestStars: 0, bestTimeMs: 0 },
  economy: { coins: 88, totalEarned: 600 },
  selectedTheme: 'sky', unlockedThemes: ['sky'],
  achievements: {},
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
const errors = [];
try {
  await waitServer();
  // 确认资源可访问
  const artResp = await fetch(`${BASE}assets/player-sky.png`);
  console.log('player-sky.png HTTP:', artResp.status, artResp.headers.get('content-type'));

  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.addInitScript((s) => localStorage.setItem('hex-breaker:save', s), save);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#game canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}v9-home.png` });

  const box = await page.locator('#game canvas').boundingBox();

  // 主题商店（设计坐标 cx+76, startY+246 = 346,678 / 540x960）
  await page.mouse.click(box.x + box.width * (346 / 540), box.y + box.height * (678 / 960));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}v9-themes.png` });

  // 重新载入回主页，进战役验证游戏内角色
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#game canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45); // 继续闯关
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}v9-game-base.png` });

  await page.close();
  await browser.close();
  console.log('QA11_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
