/** m:ss.t formatting for run timers. */
export function formatTimeMs(ms: number): string {
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
