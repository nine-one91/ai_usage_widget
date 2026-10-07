import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, SessionMeasureInput } from 'claude-code'
import { exportFileName } from './fileName'

const LIMITS = [
  { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-07T09:30:00.000Z' },
  { kind: 'seven_day', percentUsed: 7 },
]

const measure = (patch: Partial<SessionMeasureInput>): SessionMeasureInput => ({
  context: { window: 200_000 },
  rateLimits: LIMITS,
  changed: ['rateLimits'],
  ...patch,
})

/** 엔진 대신 env/clock/fs를 받아주고, 쓴 파일을 모은다 */
function fakeHost(on: On, env: Record<string, string>) {
  const writes: Array<{ path: string; text: string }> = []
  mock.env(on, env)
  mock.clock(on, { now: 1_000 })
  on('fs.write', (_$, e) => {
    writes.push(e)
    return { value: undefined }
  })
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  return writes
}

describe('usage-export', () => {
  test('한도가 바뀌면 설정 폴더 이름으로 파일을 쓴다', async ($, on) => {
    const writes = fakeHost(on, { HOME: '/Users/me', CLAUDE_CONFIG_DIR: '/Users/me/.claude-personal' })
    await $.session.measure(measure({}))
    expect(writes.length).toBe(1)
    expect(writes[0].path).toBe('/Users/me/.ai-usage-widget/claude/claude-personal.json')
    expect(JSON.parse(writes[0].text)).toEqual({
      version: 1,
      configDir: '/Users/me/.claude-personal',
      updatedAt: 1_000,
      rateLimits: LIMITS,
    })
  })

  test('CLAUDE_CONFIG_DIR가 없으면 ~/.claude (Desktop Code 탭)', async ($, on) => {
    const writes = fakeHost(on, { HOME: '/Users/me' })
    await $.session.measure(measure({}))
    expect(writes[0].path).toBe('/Users/me/.ai-usage-widget/claude/claude.json')
  })

  test('한도가 바뀌지 않은 측정은 쓰지 않는다', async ($, on) => {
    const writes = fakeHost(on, { HOME: '/Users/me' })
    await $.session.measure(measure({ changed: ['context'] }))
    expect(writes.length).toBe(0)
  })

  test('파일 쓰기가 실패해도 측정 결과는 그대로 돌려준다', async ($, on) => {
    mock.env(on, { HOME: '/Users/me' })
    mock.clock(on, { now: 1_000 })
    on('fs.write', () => {
      throw new Error('disk full')
    })
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    expect(await $.session.measure(measure({}))).toEqual({ changed: ['rateLimits'] })
  })
})

test('exportFileName', () => {
  expect(exportFileName('/Users/me/.claude')).toBe('claude.json')
  expect(exportFileName('/Users/me/.claude-work/')).toBe('claude-work.json')
  expect(exportFileName('C:\\Users\\me\\.claude')).toBe('claude.json')
})
