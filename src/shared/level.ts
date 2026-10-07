import type { Level, UsageSnapshot } from './types'

export const LEVELS: Level[] = ['unknown', 'calm', 'normal', 'warn', 'limit']

export function levelForPercent(percent: number): Level {
  if (percent >= 100) return 'limit'
  if (percent >= 80) return 'warn'
  if (percent >= 50) return 'normal'
  return 'calm'
}

/** 모든 계정의 모든 한도 중 가장 높은 사용률로 캐릭터 상태를 정한다. */
export function overallLevel(snapshots: UsageSnapshot[]): Level {
  const percents = snapshots
    .filter((s) => s.status === 'ok')
    .flatMap((s) => s.windows.map((w) => w.percent))
  if (percents.length === 0) return 'unknown'
  return levelForPercent(Math.max(...percents))
}
