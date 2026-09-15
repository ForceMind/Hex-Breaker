// QA 第五轮：关卡模式全流程（主页→闯关→胜利）+ 选关 + 每日挑战 + 移动端
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
  await pc.waitForTimeout(2500);
  await pc.screenshot({ path: OUT + 'v3-1-home.png' });

  // 继续闯关（startY=452/960=0.471）→ 第 1 关
  await canvasClick(pc, 0.5, 0.471);
  await pc.waitForTimeout(5000);
  await pc.screenshot({ path: OUT + 'v3-2-level1.png' });

  // 挂机自动射击，等胜利（目标 24 杀，自动射击约 20-40 秒）
  for (let i = 0; i < 20; i++) {
    await pc.waitForTimeout(5000);
    const unlocked = await pc.evaluate(() => {
      const s = localStorage.getItem('hex-breaker:save');
      return s ? JSON.parse(s).campaign?.unlockedLevel ?? 1 : 1;
    });
    if (unlocked > 1) { console.log('VICTORY at iter', i); break; }
  }
  await pc.waitForTimeout(1500);
  await pc.screenshot({ path: OUT + 'v3-3-victory.png' });

  // 胜利面板按钮：下一关/重玩/返回 —— 点返回（最下方按钮，位置粗测）
  await canvasClick(pc, 0.5, 0.72);
  await pc.waitForTimeout(1200);
  await pc.screenshot({ path: OUT + 'v3-4-after-victory.png' });

  // 主页 → 选关（x 0.348, y 0.567）
  await canvasClick(pc, 0.35, 0.567);
  await pc.waitForTimeout(1500);
  await pc.screenshot({ path: OUT + 'v3-5-levelselect.png' });

  // 返回主页 → 每日挑战
  await canvasClick(pc, 0.5, 0.92);
  await pc.waitForTimeout(1000);
  await canvasClick(pc, 0.65, 0.567);
  await pc.waitForTimeout(1500);
  await pc.screenshot({ path: OUT + 'v3-6-daily.png' });

  // 每日挑战开局
  await canvasClick(pc, 0.5, 0.62);
  await pc.waitForTimeout(4000);
  await pc.screenshot({ path: OUT + 'v3-7-daily-game.png' });

  // 移动端：主页 + 关卡画面（看飞船）
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mob.on('pageerror', (e) => errors.push('MOB pageerror: ' + e.message));
  await mob.goto(BASE, { waitUntil: 'networkidle' });
  await mob.waitForSelector('#game canvas', { timeout: 15000 });
  await mob.waitForTimeout(2500);
  await mob.screenshot({ path: OUT + 'v3-8-mob-home.png' });
  const box = await mob.locator('#game canvas').boundingBox();
  const startY = Math.min(1168 - 420, 452) / 1168; // 移动端 H=1168 → startY=452
  await mob.mouse.click(box.x + box.width * 0.5, box.y + box.height * startY);
  await mob.waitForTimeout(6000);
  await mob.screenshot({ path: OUT + 'v3-9-mob-level.png' });

  await browser.close();
  console.log('QA5_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
