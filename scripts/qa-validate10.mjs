// QA 第十轮：v2.6.0——主页 ghost 按钮新样式 + 金币胶囊「+」充值弹窗 + 基础版黄方块角色
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
  selectedTheme: 'sky', unlockedThemes: ['sky', 'forest'],
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
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.addInitScript((s) => localStorage.setItem('hex-breaker:save', s), save);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#game canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}v8-home.png` });

  // 充值弹窗：金币胶囊右上角「+」(设计坐标约 badge 右端 = W-34, y=33 → 比例 x≈0.94, y≈0.034)
  const box = await page.locator('#game canvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.94, box.y + box.height * 0.036);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}v8-recharge.png` });

  // 点 ¥68 档（卡片 grid: row1 col2, 面板坐标 x=+96/540≈0.678, y≈-86+54=-32 → 面板中心 y≈H/2-32 → 比例≈0.5-32/960≈0.467）
  // 档位卡 buy 按钮在卡内 y+34: 卡1行 y=-86+54=-32; buy y=-32+34=2 → 面板相对 2 → 绝对 H/2+2 → 0.502
  await page.mouse.click(box.x + box.width * 0.678, box.y + box.height * 0.502);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}v8-recharge-paying.png` });
  await page.waitForTimeout(1200); // 900ms 模拟支付 + toast
  await page.screenshot({ path: `${OUT}v8-recharge-done.png` });
  const coins = await page.evaluate(() => JSON.parse(localStorage.getItem('hex-breaker:save') || '{}').economy?.coins);
  console.log('COINS_AFTER_RECHARGE:', coins, '(expect 88+680=768)');

  // 进游戏验证基础版黄方块 + 掉落名称
  await page.waitForTimeout(1500);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45); // 继续闯关
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}v8-game-base.png` });

  await page.close();
  await browser.close();
  console.log('QA10_DONE');
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
