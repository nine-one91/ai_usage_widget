import type { UsageWindow } from '../../shared/types'
import { exportFileName } from '../../../claude-mod/usage-export/hooks/fileName'
import { clampPercent } from './percent'

// claude-mod/usage-export 가 쓰는 파일 형식 (version 1)
interface ModExportRaw {
  version?: number
  configDir?: string
  updatedAt?: number
  rateLimits?: Array<{ kind?: string; percentUsed?: number; resetsAt?: string }>
}

export interface ModRecord {
  /** epoch ms — mod가 기록한 시각 */
  updatedAt: number
  windows: UsageWindow[]
}

const LABELS: Record<string, string> = {
  five_hour: '5시간',
  seven_day: '주간',
  seven_day_opus: '주간 · Opus',
  seven_day_sonnet: '주간 · Sonnet',
  spend_limit: '지출 한도'
}

/** mod와 같은 파일 이름 규칙 (claude-mod/usage-export/hooks/fileName.ts) */
export const modExportFileName = exportFileName

/** 리셋 시각이 `now` 이전인 한도는 이미 초기화된 것으로 보고 0%로 바꾼다. */
export function parseModExport(text: string, now: number): ModRecord {
  const data = JSON.parse(text) as ModExportRaw
  if (data.version !== 1) throw new Error(`알 수 없는 mod 파일 버전: ${data.version}`)
  if (typeof data.updatedAt !== 'number') throw new Error('mod 파일에 기록 시각이 없어요')

  const windows: UsageWindow[] = []
  for (const raw of data.rateLimits ?? []) {
    if (!raw.kind || typeof raw.percentUsed !== 'number') continue
    const resetsAt = raw.resetsAt ? Date.parse(raw.resetsAt) : NaN
    const resetPassed = Number.isFinite(resetsAt) && resetsAt <= now
    windows.push({
      key: raw.kind,
      label: LABELS[raw.kind] ?? raw.kind,
      percent: resetPassed ? 0 : clampPercent(raw.percentUsed),
      resetsAt: resetPassed || !Number.isFinite(resetsAt) ? null : resetsAt,
      ...(resetPassed ? { resetPassed } : {})
    })
  }
  return { updatedAt: data.updatedAt, windows }
}
