import type { UsageWindow } from '../../shared/types'
import { clampPercent } from './percent'

// ~/.codex/sessions/**/rollout-*.jsonl 의 token_count 이벤트에 실린 rate_limits
interface CodexWindowRaw {
  used_percent?: number
  window_minutes?: number
  /** unix seconds */
  resets_at?: number
}

interface CodexRateLimitsRaw {
  limit_id?: string | null
  primary?: CodexWindowRaw | null
  secondary?: CodexWindowRaw | null
  plan_type?: string | null
}

export interface CodexRateLimitRecord {
  /** epoch ms — 이 값이 기록된 시각 */
  timestamp: number
  windows: UsageWindow[]
  plan?: string
}

/**
 * JSONL 한 줄에서 사용 한도를 꺼낸다. 해당 줄이 아니면 null.
 * `now`보다 리셋 시각이 과거면 이미 초기화된 것으로 보고 0%로 바꾼다.
 */
export function parseCodexLine(line: string, now: number): CodexRateLimitRecord | null {
  if (!line.includes('"rate_limits"')) return null
  let entry: any
  try {
    entry = JSON.parse(line)
  } catch {
    return null // 기록 중인 마지막 줄은 잘려 있을 수 있다
  }
  const payload = entry?.payload
  if (payload?.type !== 'token_count') return null
  const limits: CodexRateLimitsRaw | undefined = payload.rate_limits
  if (!limits) return null
  // code review 등 별도 한도는 제외
  if (limits.limit_id && limits.limit_id !== 'codex') return null

  const windows = [
    toWindow('primary', limits.primary, now),
    toWindow('secondary', limits.secondary, now)
  ].filter((w): w is UsageWindow => w !== null)
  if (windows.length === 0) return null

  return {
    timestamp: Date.parse(entry.timestamp) || now,
    windows,
    plan: limits.plan_type ?? undefined
  }
}

/** 파일 끝부분 텍스트에서 가장 마지막 사용 한도 기록을 찾는다. */
export function findLatestCodexRecord(text: string, now: number): CodexRateLimitRecord | null {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const record = parseCodexLine(lines[i], now)
    if (record) return record
  }
  return null
}

function toWindow(key: string, raw: CodexWindowRaw | null | undefined, now: number): UsageWindow | null {
  if (!raw || typeof raw.used_percent !== 'number') return null
  const resetsAt = typeof raw.resets_at === 'number' ? raw.resets_at * 1000 : null
  const resetPassed = resetsAt !== null && resetsAt <= now
  return {
    key,
    label: windowLabel(raw.window_minutes),
    percent: resetPassed ? 0 : clampPercent(raw.used_percent),
    resetsAt: resetPassed ? null : resetsAt,
    ...(resetPassed ? { resetPassed } : {})
  }
}

export function windowLabel(minutes: number | undefined): string {
  if (!minutes) return '한도'
  if (minutes === 10080) return '주간'
  if (minutes % 1440 === 0) return `${minutes / 1440}일`
  if (minutes % 60 === 0) return `${minutes / 60}시간`
  return `${minutes}분`
}
