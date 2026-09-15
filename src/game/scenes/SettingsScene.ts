import { themeColors } from '../config/themes';
import { canShowInstallEntry } from '../../services/pwa';
import { Button } from '../ui/Button';
import { openInstallFlow } from '../ui/installPrompt';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';
import { showToast } from '../ui/Toast';
import { BaseScene } from './BaseScene';

/** music / sound / vibration toggles and a guarded save-reset. */
export class SettingsScene extends BaseScene {
  constructor() {
    super('SettingsScene');
  }

  create(): void {
    this.addBackground();
    this.fadeIn();
    const COLORS = themeColors();

    const cx = this.W / 2;
    this.text(cx, 66, '设置', { size: 34, bold: true });

    const settings = this.svc.save.get().settings;
    const rows: { label: string; key: 'music' | 'sound' | 'vibration' }[] = [
      { label: '音乐', key: 'music' },
      { label: '音效', key: 'sound' },
      { label: '震动', key: 'vibration' },
    ];

    // All toggles live in one white card (r22, soft shadow).
    const cardX = cx - 210;
    const cardY = 150;
    const cardW = 420;
    const cardH = rows.length * 84 + 24;
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.12);
    card.fillRoundedRect(cardX, cardY + 5, cardW, cardH, 22);
    card.fillStyle(0xffffff, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 22);

    rows.forEach((row, i) => {
      const y = cardY + 12 + 42 + i * 84;
      this.text(cardX + 28, y, row.label, { size: 20, align: 'left', bold: true });
      if (i > 0) {
        const divider = this.add.graphics();
        divider.fillStyle(COLORS.textPrimary, 0.06);
        divider.fillRect(cardX + 24, y - 42, cardW - 48, 1);
      }
      new Toggle(this, cardX + cardW - 62, y, {
        value: settings[row.key],
        onChange: (v) => {
          this.svc.save.update((d) => {
            d.settings[row.key] = v;
          });
          this.svc.applySettings();
        },
      });
    });

    let nextY = cardY + cardH + 56;
    // PWA install entry: only when this browser can actually offer it.
    if (canShowInstallEntry()) {
      new Button(this, cx, nextY, {
        label: '安装到主屏',
        width: 280,
        height: 58,
        onClick: () => openInstallFlow(this),
      });
      nextY += 74;
    }

    new Button(this, cx, nextY, {
      label: '清除存档',
      variant: 'danger',
      width: 280,
      height: 58,
      onClick: () => this.confirmReset(),
    });

    new Button(this, cx, this.H - 62, { label: '返回', width: 320, height: 60, onClick: () => this.go('HomeScene') });
    this.input.keyboard?.once('keydown-ESC', () => this.go('HomeScene'));
  }

  private confirmReset(): void {
    const modal = new Modal(this, this.W, this.H, { width: 420, height: 300, title: '清除存档' });
    const msg = this.text(0, -40, '将清空最高分、最高等级与全部统计，\n且无法恢复。确定要继续吗？', { size: 18, color: themeColors().textSecondary, lineSpacing: 6 });
    modal.panel.add(msg);
    const yes = new Button(this, -100, 70, {
      label: '确定清除',
      variant: 'danger',
      width: 170,
      height: 54,
      fontSize: 18,
      onClick: () => {
        this.svc.save.reset();
        this.svc.applySettings();
        modal.close(() => this.refresh());
        showToast(this, this.W / 2, this.H / 2 - 200, '存档已清除');
      },
    });
    const no = new Button(this, 100, 70, {
      label: '取消',
      variant: 'secondary',
      width: 170,
      height: 54,
      fontSize: 18,
      onClick: () => modal.close(),
    });
    modal.panel.add([yes, no]);
  }
}
