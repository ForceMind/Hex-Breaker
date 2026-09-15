import { activeThemeId, themeColors } from '../config/themes';
import { itemName } from '../../core/itemNames';
import { Button } from '../ui/Button';
import { BaseScene } from './BaseScene';

interface Section {
  title: string;
  body: string;
}

function buildSections(): Section[] {
  const n = (t: Parameters<typeof itemName>[1]): string => itemName(activeThemeId(), t);
  return [
  {
    title: '游戏模式',
    body: '关卡模式：消灭目标数量的瓦片即可获胜，通关解锁下一关（共 30 关）；按损失生命评星——未掉命 3 星，掉 1 命 2 星。\n每日挑战：所有玩家今天面对完全相同的关卡（相同阵型、血量与掉落），无论胜负都算打卡，连续天数会累积。\n无尽模式：瓦片无限流下，冲击最高分；30 级后瓦片血量上限与下落速度持续增长，压力不断升级。',
  },
  {
    title: '操作',
    body: '← / → 键或手指左右拖动控制方块移动，自动向上射击。\nP 暂停，ESC 返回主页。\n八边形瓦片不断从顶部流下，撞上就会损失生命（共 3 条）。',
  },
  {
    title: '武器（可叠加，最高 Lv5）',
    body: `${n('uzi')}：极速连射，Lv3 起双发\n${n('shotgun')}：扇形多发，Lv4 起大型弹\n${n('laser')}：伤害 3，Lv3 起大弹，Lv5 三连发\n${n('spread')}：扇面覆盖，Lv3 起散射更宽`,
  },
  {
    title: '道具',
    body: '炸弹 5 种：普通 / 大型 / 斜射 / 横向 / 线性，范围随类型变化。\n回旋镖：弧线飞出，击杀后穿透直飞，返程变绿，靠近可接住重新抛出。\n护盾挡一次撞击；强化护盾持续 10 秒。\n永久增益：双子弹 / 加速 / 连射 / 穿透 / 磁力 / 大弹 / 持久 / 生命+1，15 级前随等级逐步解锁。\n道具名称随皮肤主题变化（同一效果，各皮肤叫法不同）。',
  },
  {
    title: 'BOSS 关',
    body: '第 10 / 20 / 30 关是 BOSS 关：击败顶部的大号红色 BOSS 即可获胜（不再要求消灭数量）。\nBOSS 不会下落，每隔约 4 秒喷出一波护卫瓦片；子弹命中 BOSS 扣血，顶部红条是它的血量。',
  },
  {
    title: '金币与主题',
    body: '金币：关卡首通 +30、重复通关 +10，每日挑战首次通关 +20，无尽模式按得分的 1/10 结算（单局上限 50）。\n主页「主题」里可用金币解锁 8 套皮肤主题（角色 + 配套背景），解锁后角色形象与全场景配色即时生效。',
  },
  {
    title: '排行榜',
    body: '主页「排行」查看无尽模式本周榜：100 名模拟玩家的成绩由本周种子决定，人人相同。\n榜单每周一 0 点（UTC）重置，以你的无尽最高分参与排名。',
  },
  {
    title: '难度系统',
    body: '摧毁 8 块瓦片升 1 级，瓦片流速随等级与战力提升。\n战力由武器等级与永久增益计算，战力越高瓦片越密、血量越厚。\n3 级起出现 13 种行阵型（走廊 / 墙壁 / 菱形 / 波浪……）。',
  },
  ];
}

/** Scrolling help screen (drag to scroll when content overflows). */
export class HelpScene extends BaseScene {
  constructor() {
    super('HelpScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();
    const COLORS = themeColors();

    const cx = this.W / 2;
    this.text(cx, 66, '玩法说明', { size: 34, bold: true });

    // Content sits in one white card (r22, soft shadow).
    const cardX = 20;
    const cardY = 104;
    const cardW = this.W - 40;
    const cardH = this.H - cardY - 96;
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.12);
    card.fillRoundedRect(cardX, cardY + 5, cardW, cardH, 22);
    card.fillStyle(0xffffff, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 22);

    const pad = 24;
    const top = cardY + 26;
    const bottom = cardY + cardH - 20;
    const content = this.add.container(0, 0);

    let y = top;
    for (const s of buildSections()) {
      const title = this.text(cardX + pad, y, s.title, { size: 21, bold: true, align: 'left' });
      content.add(title);
      y += 34;
      const body = this.text(cardX + pad, y, s.body, { size: 16, color: COLORS.textSecondary, align: 'left', wrap: cardW - pad * 2, lineSpacing: 8 });
      body.setOrigin(0, 0);
      content.add(body);
      y += body.height + 32;
    }
    const contentHeight = y - top;
    const viewHeight = bottom - top;

    if (contentHeight > viewHeight) {
      // Drag-to-scroll with a camera masked to the card interior.
      const cam = this.cameras.main;
      const maskG = this.make.graphics({ x: 0, y: 0 }, false);
      maskG.fillRect(cardX + 4, top - 8, cardW - 8, viewHeight + 16);
      content.setMask(maskG.createGeometryMask());
      let dragY: number | null = null;
      let startContentY = 0;
      const minY = -(contentHeight - viewHeight);
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        dragY = p.y;
        startContentY = content.y;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (dragY === null || !p.isDown) return;
        content.y = Phaser.Math.Clamp(startContentY + (p.y - dragY) / cam.zoom, minY, 0);
      });
      this.input.on('pointerup', () => {
        dragY = null;
      });
      this.text(cx, cardY + cardH - 22, '上下拖动查看更多', { size: 13, color: COLORS.textSecondary, alpha: 0.8 });
    }

    new Button(this, cx, this.H - 56, { label: '返回', width: 320, height: 60, onClick: () => this.go('HomeScene') });

    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }
}
