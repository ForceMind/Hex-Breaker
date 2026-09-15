// QA 第三轮：挂机等到游戏结束，验证结算面板（新纪录徽章/彩带/按钮）
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

  const box = await pc.locator('#game canvas').boundingBox();
  await pc.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.521); // 开始游戏
  await pc.waitForTimeout(3000);

  // 挂机不动，等三条命耗光（最多 240 秒），用像素变化粗判结束面板出现
  let over = false;
  for (let i = 0; i < 48; i++) {
    await pc.waitForTimeout(5000);
    const hearts = await pc.evaluate(() => {
      const c = document.querySelector('#game canvas');
      return c ? c.width : 0;
    });
    void hearts;
    // 直接读游戏状态：无存档写入说明还在打；结束时 save.gamesPlayed 会 +1
    const played = await pc.evaluate(() => {
      const s = localStorage.getItem('hex-breaker:save');
      return s ? JSON.parse(s).gamesPlayed : 0;
    });
    if (played > 0) { over = true; break; }
  }
  console.log('GAME_OVER_REACHED:', over);
  await pc.waitForTimeout(1200);
  await pc.screenshot({ path: OUT + 'pc-11-gameover.png' });

  // 点「再来一局」验证重开
  const box2 = await pc.locator('#game canvas').boundingBox();
  await pc.mouse.click(box2.x + box2.width * 0.5, box2.y + box2.height * 0.66);
  await pc.waitForTimeout(2500);
  await pc.screenshot({ path: OUT + 'pc-12-restart.png' });

  await browser.close();
  console.log('QA3_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
