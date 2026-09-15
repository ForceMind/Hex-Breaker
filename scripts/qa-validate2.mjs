// QA 第二轮：精确点击“开始游戏”，验证 GameScene / 暂停 / ESC 返回
import { createRequire } from 'node:module';
const require = createRequire('/Volumes/Work/Prive/Arrow Flow/package.json');
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4199;
const BASE = `http://localhost:${PORT}/`;
const OUT = new URL('../qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

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
  await pc.goto(BASE, { waitUntil: 'networkidle' });
  await pc.waitForSelector('#game canvas', { timeout: 15000 });
  await pc.waitForTimeout(2000);

  // 开始游戏（design 960 高，startY=500 → 0.521）
  await canvasClick(pc, 0.5, 0.521);
  await pc.waitForTimeout(3000);
  await pc.keyboard.down('ArrowLeft'); await pc.waitForTimeout(500); await pc.keyboard.up('ArrowLeft');
  await pc.waitForTimeout(4000);
  await pc.screenshot({ path: OUT + 'pc-7-gameplay.png' });

  // 暂停 / 恢复
  await pc.keyboard.press('p');
  await pc.waitForTimeout(800);
  await pc.screenshot({ path: OUT + 'pc-8-pause.png' });
  await pc.keyboard.press('p');
  await pc.waitForTimeout(8000); // 继续打，等瓦片逼近、道具掉落
  await pc.screenshot({ path: OUT + 'pc-9-gameplay2.png' });

  // ESC 返回主页
  await pc.keyboard.press('Escape');
  await pc.waitForTimeout(1200);
  await pc.screenshot({ path: OUT + 'pc-10-esc-home.png' });

  // 移动端开局
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mob.on('pageerror', (e) => errors.push('MOB pageerror: ' + e.message));
  await mob.goto(BASE, { waitUntil: 'networkidle' });
  await mob.waitForSelector('#game canvas', { timeout: 15000 });
  await mob.waitForTimeout(2000);
  await canvasClick(mob, 0.5, 0.428); // design 1168 高，startY=500 → 0.428
  await mob.waitForTimeout(6000);
  await mob.screenshot({ path: OUT + 'mob-3-gameplay.png' });

  await browser.close();
  console.log('QA2_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
