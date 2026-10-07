/** 0–100 범위, 소수 첫째 자리까지 */
export function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10))
}
