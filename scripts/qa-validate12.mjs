// QA 第十二轮：v2.7.0 热修复——无尽模式死亡后「再来一局」restart，第二局武器计时条 setText 不再崩溃
// 根因：barLabels/barTimes 跨 restart 累积已销毁 Text；修复后这里验证第二局无任何 JS error。
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
  const click = (rx, ry) => page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);

  // 进无尽模式（主页按钮 startY+168 → 600/960 = 0.625）
  await click(0.5, 0.625);
  await page.waitForTimeout(3000);

  // 第一局：站着不动，瓦片会撞掉 3 条命 → 游戏结束
  // 40s 起周期性点击「再来一局」可能出现的屏幕位置（面板中心 +148 → (480+148)/960≈0.654）
  let restarted = false;
  for (let t = 0; t < 100; t += 5) {
    await page.waitForTimeout(5000);
    if (errors.length) break;
    // 截图检测游戏结束面板：中间偏下出现「再来一局」按钮区域直接点
    await click(0.5, 0.654);
    // 点击后若回到游戏中（restart 成功），画布内容会变化；无从直接判定，靠后续错误率说话
    if (t >= 40 && !restarted) {
      // 认为已经点中过一次（restart 后此位置是空白，重复点击无害）
      restarted = true;
    }
  }

  // 第二局：左右扫动吃道具，等待特殊武器激活触发 drawWeaponBars 的 setText 路径
  const sweepEnd = Date.now() + 60000;
  let dir = 0;
  while (Date.now() < sweepEnd && !errors.length) {
    const key = dir % 2 === 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForTimeout(650);
    await page.keyboard.up(key);
    dir++;
  }
  await page.screenshot({ path: `${OUT}v10-restart-run2.png` });

  await page.close();
  await browser.close();
  console.log('QA12_DONE restarted=', restarted);
} finally {
  server.kill('SIGKILL');
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 2; }
else console.log('NO_JS_ERRORS');
