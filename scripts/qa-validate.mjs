// 一次性 QA 验证脚本：vite preview + Playwright 截图，退出前自动清理服务器
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
  stdio: 'pipe',
});
let serverOut = '';
server.stdout.on('data', (d) => (serverOut += d));
server.stderr.on('data', (d) => (serverOut += d));

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start:\n' + serverOut);
}

async function canvasClick(page, fx, fy) {
  // 按 canvas  bounding box 内的相对坐标点击（fx/fy ∈ 0..1，相对游戏设计画面）
  const box = await page.locator('#game canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

const errors = [];
try {
  await waitServer();
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });

  // ---- PC 宽屏：验证“手机框”居中竖屏卡片 ----
  const pc = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  pc.on('pageerror', (e) => errors.push('PC pageerror: ' + e.message));
  pc.on('console', (m) => m.type() === 'error' && errors.push('PC console: ' + m.text()));
  await pc.goto(BASE, { waitUntil: 'networkidle' });
  await pc.waitForSelector('#game canvas', { timeout: 15000 });
  await pc.waitForTimeout(2500);
  await pc.screenshot({ path: OUT + 'pc-1-home.png' });

  // 主页按钮：开始游戏 / 玩法说明 / 设置（自上而下居中）
  // 先点开设置验证界面连通
  await canvasClick(pc, 0.5, 0.72);
  await pc.waitForTimeout(1200);
  await pc.screenshot({ path: OUT + 'pc-2-mid.png' });

  // 回主页（点返回按钮通常在左下/底部），若当前不是主页则多点几次底部中间
  await canvasClick(pc, 0.5, 0.9);
  await pc.waitForTimeout(1000);
  await pc.screenshot({ path: OUT + 'pc-3-back.png' });

  // 点开始游戏（主页第一个主按钮）
  await canvasClick(pc, 0.5, 0.48);
  await pc.waitForTimeout(2500);
  await pc.keyboard.down('ArrowLeft');
  await pc.waitForTimeout(600);
  await pc.keyboard.up('ArrowLeft');
  await pc.waitForTimeout(1500);
  await pc.keyboard.down('ArrowRight');
  await pc.waitForTimeout(600);
  await pc.keyboard.up('ArrowRight');
  await pc.waitForTimeout(2000);
  await pc.screenshot({ path: OUT + 'pc-4-game.png' });

  // 暂停
  await pc.keyboard.press('p');
  await pc.waitForTimeout(800);
  await pc.screenshot({ path: OUT + 'pc-5-pause.png' });
  await pc.keyboard.press('p');
  await pc.waitForTimeout(500);

  // 玩 20 秒再看一眼（让瓦片流下来、可能掉道具）
  await pc.waitForTimeout(20000);
  await pc.screenshot({ path: OUT + 'pc-6-game-later.png' });

  // localStorage 存档检查
  const save = await pc.evaluate(() => localStorage.getItem('hex-breaker:save'));
  console.log('SAVE_KEY:', save ? save.slice(0, 200) : '(none)');

  // ---- 移动竖屏 ----
  const mob = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  mob.on('pageerror', (e) => errors.push('MOB pageerror: ' + e.message));
  await mob.goto(BASE, { waitUntil: 'networkidle' });
  await mob.waitForSelector('#game canvas', { timeout: 15000 });
  await mob.waitForTimeout(2500);
  await mob.screenshot({ path: OUT + 'mob-1-home.png' });
  await canvasClick(mob, 0.5, 0.48);
  await mob.waitForTimeout(4000);
  await mob.screenshot({ path: OUT + 'mob-2-game.png' });

  await browser.close();
  console.log('QA_DONE');
} finally {
  server.kill('SIGTERM');
  setTimeout(() => server.kill('SIGKILL'), 2000).unref();
}
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exitCode = 2;
}
