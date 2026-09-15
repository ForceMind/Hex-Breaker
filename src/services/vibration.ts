/** Thin wrapper over the Vibration API; silent when unsupported. */
export class VibrationService {
  private enabled = true;
  private readonly supported: boolean;

  constructor() {
    // Presence of navigator.vibrate alone is not meaningful: Chromium
    // implements it on desktops with no motor. Require a touch device too.
    const hasVibrateApi = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    this.supported = hasVibrateApi && isTouchDevice;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  isSupported(): boolean {
    return this.supported;
  }

  vibrate(pattern: number | number[]): void {
    if (!this.enabled || !this.supported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* some browsers throw when not triggered by a gesture */
    }
  }

  tap(): void {
    this.vibrate(15);
  }

  error(): void {
    this.vibrate([30, 40, 30]);
  }

  explode(): void {
    this.vibrate([40, 30, 60]);
  }

  win(): void {
    this.vibrate([20, 60, 20, 60, 40]);
  }
}
