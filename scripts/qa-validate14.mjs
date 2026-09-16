// QA 第十四轮：成就页布局检查（文字是否挤压/溢出）
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
  achievements: {
    'tiles-100': 1758000000000, 'tiles-500': 1758100000000, 'endless-lv10': 1758200000000,
    'games-10': 1758300000000, 'coins-100': 1758400000000,
  },
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
  const box = await page.locator('#game canvas').boundingBox();
  // 成就按钮：cx-76, startY+300 → (194/540, 732/960)
  await page.mouse.click(box.x + box.width * (194 / 540), box.y + box.height * (732 / 960));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}v12-achievements.png` });
  await page.close();
  await browser.close();
  console.log('QA14_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
