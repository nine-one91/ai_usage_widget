import { describe, expect, it } from 'vitest'
import { overallLevel } from '../src/shared/level'
import type { UsageSnapshot } from '../src/shared/types'
import { findLatestCodexRecord, parseCodexLine, windowLabel } from '../src/main/parsers/codex'

const codexLine = (rateLimits: unknown, timestamp = '2026-10-07T00:00:00.000Z') =>
  JSON.stringify({ timestamp, type: 'event_msg', payload: { type: 'token_count', info: {}, rate_limits: rateLimits } })

const NOW = Date.parse('2026-10-07T01:00:00Z')

describe('parseCodexLine', () => {
  it('primary/secondary 한도를 기간에 맞는 이름으로 읽는다', () => {
    const line = codexLine({
      limit_id: 'codex',
      primary: { used_percent: 18, window_minutes: 300, resets_at: NOW / 1000 + 3600 },
      secondary: { used_percent: 3, window_minutes: 10080, resets_at: NOW / 1000 + 86400 },
      plan_type: 'plus'
    })
    expect(parseCodexLine(line, NOW)).toEqual({
      timestamp: Date.parse('2026-10-07T00:00:00.000Z'),
      plan: 'plus',
      windows: [
        { key: 'primary', label: '5시간', percent: 18, resetsAt: NOW + 3_600_000 },
        { key: 'secondary', label: '주간', percent: 3, resetsAt: NOW + 86_400_000 }
      ]
    })
  })

  it('리셋 시각이 지난 기록은 0%로 본다', () => {
    const line = codexLine({ primary: { used_percent: 90, window_minutes: 300, resets_at: NOW / 1000 - 1 } })
    expect(parseCodexLine(line, NOW)?.windows[0]).toMatchObject({ percent: 0, resetPassed: true, resetsAt: null })
  })

  it('다른 이벤트, 잘린 줄, 다른 limit_id는 무시한다', () => {
    expect(parseCodexLine('{"type":"response_item"}', NOW)).toBeNull()
    expect(parseCodexLine('{"payload":{"type":"token_count","rate_limits":{"prim', NOW)).toBeNull()
    expect(parseCodexLine(codexLine({ limit_id: 'code_review', primary: { used_percent: 1 } }), NOW)).toBeNull()
    expect(parseCodexLine(codexLine(null), NOW)).toBeNull()
  })

  it('파일 끝에서부터 가장 최근 기록을 찾는다', () => {
    const text = [
      codexLine({ primary: { used_percent: 10, window_minutes: 300 } }),
      codexLine({ primary: { used_percent: 20, window_minutes: 300 } }),
      '{"type":"response_item"}',
      '{"partial'
    ].join('\n')
    expect(findLatestCodexRecord(text, NOW)?.windows[0].percent).toBe(20)
  })

  it('windowLabel', () => {
    expect(windowLabel(300)).toBe('5시간')
    expect(windowLabel(10080)).toBe('주간')
    expect(windowLabel(2880)).toBe('2일')
    expect(windowLabel(undefined)).toBe('한도')
  })
})

describe('overallLevel', () => {
  const snap = (percents: number[], status: UsageSnapshot['status'] = 'ok'): UsageSnapshot => ({
    accountId: 'a',
    provider: 'claude',
    source: 'mod',
    label: 'a',
    status,
    updatedAt: 0,
    windows: percents.map((percent, i) => ({ key: String(i), label: '', percent, resetsAt: null }))
  })

  it('가장 높은 사용률 기준', () => {
    expect(overallLevel([snap([10]), snap([85])])).toBe('warn')
    expect(overallLevel([snap([100])])).toBe('limit')
    expect(overallLevel([snap([49])])).toBe('calm')
  })

  it('정상 데이터가 없으면 unknown', () => {
    expect(overallLevel([snap([90], 'error')])).toBe('unknown')
    expect(overallLevel([])).toBe('unknown')
  })
})
