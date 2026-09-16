// QA 第十三轮：v2.8.0——fps.limit=60 下游戏正常 + 开启音乐/音效无 JS error
import { createRequire } from 'node:module';
const require = createRequire('/Volumes/Work/Prive/Arrow Flow/package.json');
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4199;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// 注意：音乐与音效都开启
const save = JSON.stringify({
  version: 5, highScore: 137, bestLevel: 18, gamesPlayed: 12, totalTilesDestroyed: 400,
  settings: { music: true, sound: true, vibration: false },
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
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.addInitScript((s) => localStorage.setItem('hex-breaker:save', s), save);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#game canvas', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const box = await page.locator('#game canvas').boundingBox();
  // 用户手势解锁 AudioContext（点击 = 主页按钮以外的空白处先点一下）
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
  await page.waitForTimeout(2000); // BGM tick 若干步

  const audioState = await page.evaluate(() => {
    const w = window;
    return w.__audioDebug ?? 'n/a';
  });
  console.log('audioDebug:', audioState);

  // 进无尽模式，打 20 秒（射击/命中/爆炸/拾取等音效路径 + BGM 循环）
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.625);
  const end = Date.now() + 20000;
  let dir = 0;
  while (Date.now() < end && !errors.length) {
    const key = dir % 2 === 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    dir++;
  }
  await page.screenshot({ path: `${OUT}v11-audio-game.png` });

  await page.close();
  await browser.close();
  console.log('QA13_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
else console.log('NO_JS_ERRORS');
