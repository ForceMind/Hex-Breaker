// QA 第八轮：v2.4.0 双主题局内（AI 砖块+背景+背身角色）+ PWA 文件
import { createRequire } from 'node:module';
const require = createRequire('/Volumes/Work/Prive/Arrow Flow/package.json');
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4199;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const mkSave = (theme) => JSON.stringify({
  version: 4, highScore: 137, bestLevel: 18, gamesPlayed: 5, totalTilesDestroyed: 137,
  settings: { music: false, sound: false, vibration: false },
  campaign: { unlockedLevel: 1, records: {} },
  daily: { lastPlayedDate: '', streak: 0, bestStars: 0, bestTimeMs: 0 },
  economy: { coins: 600, totalEarned: 600 },
  selectedTheme: theme, unlockedThemes: ['sky', 'neon'],
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

  for (const theme of ['sky', 'neon']) {
    const pc = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    pc.on('pageerror', (e) => errors.push(theme + ' pageerror: ' + e.message));
    pc.on('console', (m) => m.type() === 'error' && errors.push(theme + ' console: ' + m.text()));
    await pc.addInitScript((save) => localStorage.setItem('hex-breaker:save', save), mkSave(theme));
    await pc.goto(BASE, { waitUntil: 'networkidle' });
    await pc.waitForSelector('#game canvas', { timeout: 15000 });
    await pc.waitForTimeout(2500);
    await pc.screenshot({ path: `${OUT}v6-${theme}-home.png` });
    await canvasClick(pc, 0.5, 0.471); // 继续闯关
    await pc.waitForTimeout(7000);
    await pc.screenshot({ path: `${OUT}v6-${theme}-game.png` });
    await pc.close();
  }

  // PWA 文件检查
  const pc = await browser.newPage();
  for (const p of ['manifest.webmanifest', 'sw.js', 'assets/pwa-192.png', 'assets/pwa-512.png']) {
    const r = await pc.request.get(BASE + p);
    console.log('PWA', p, r.status());
  }
  const manifest = await (await pc.request.get(BASE + 'manifest.webmanifest')).json();
  console.log('MANIFEST:', manifest.name, manifest.display, manifest.icons.length, 'icons');
  await pc.close();

  await browser.close();
  console.log('QA8_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
