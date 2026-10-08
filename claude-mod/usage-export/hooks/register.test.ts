import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, SessionMeasureInput, TurnCompleteInput } from 'claude-code'
import { activityFileName, exportFileName } from './fileName'
import { HEARTBEAT_MS } from './register'

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

/** 엔진 대신 턴·세션 이벤트와 세션 id를 받아준다. 시계를 돌려준다 */
function fakeSession(on: On, env: Record<string, string>) {
  const writes: Array<{ path: string; text: string }> = []
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1_000 })
  on('fs.write', (_$, e) => {
    writes.push(e)
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'sess-1' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  const states = () => writes.map(w => JSON.parse(w.text) as { busy: boolean; updatedAt: number; sessionId: string })
  return { writes, clock, states }
}

const complete = (patch: Partial<TurnCompleteInput> = {}): TurnCompleteInput =>
  ({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...patch }) as TurnCompleteInput

describe('작업 상태', () => {
  test('턴이 시작되면 busy, 끝나면 쉼', async ($, on) => {
    const { writes, states } = fakeSession(on, { HOME: '/Users/me', CLAUDE_CONFIG_DIR: '/Users/me/.claude-personal' })
    await $.turn.start({ text: 'hi', turnId: 't1' })
    expect(writes[0].path).toBe('/Users/me/.ai-usage-widget/activity/claude-sess-1.json')
    expect(JSON.parse(writes[0].text)).toEqual({
      version: 1,
      configDir: '/Users/me/.claude-personal',
      sessionId: 'sess-1',
      busy: true,
      updatedAt: 1_000,
    })
    await $.turn.complete(complete())
    expect(states().map(s => s.busy)).toEqual([true, false])
  })

  test('도구 하나가 오래 걸려도 타이머로 계속 갱신하고, 턴이 끝나면 멈춘다', async ($, on) => {
    const { clock, states } = fakeSession(on, { HOME: '/Users/me' })
    await $.turn.start({ text: 'build', turnId: 't1' })
    await clock.advance(HEARTBEAT_MS * 3)
    expect(states().map(s => [s.busy, s.updatedAt])).toEqual([
      [true, 1_000],
      [true, 1_000 + HEARTBEAT_MS],
      [true, 1_000 + HEARTBEAT_MS * 2],
      [true, 1_000 + HEARTBEAT_MS * 3],
    ])
    await $.turn.complete(complete({ reason: 'aborted', isAborted: true }))
    const count = states().length
    await clock.advance(HEARTBEAT_MS * 3)
    expect(states().length).toBe(count)
    expect(states().at(-1)!.busy).toBe(false)
  })

  test('서브에이전트의 턴이 끝난 건 무시한다', async ($, on) => {
    const { states } = fakeSession(on, { HOME: '/Users/me' })
    await $.turn.start({ text: 'hi', turnId: 't1' })
    await $.turn.complete(complete({ agentId: 'sub-1', turnId: 't2' }))
    expect(states().map(s => s.busy)).toEqual([true])
  })

  test('세션이 끝나면 그 세션 id로 쉼을 남긴다 (/clear 포함)', async ($, on) => {
    const { writes, states } = fakeSession(on, { HOME: '/Users/me' })
    await $.turn.start({ text: 'hi', turnId: 't1' })
    await $.session.end({ reason: 'clear', sessionId: 'old/id', resume: { id: 'old/id' } })
    expect(writes.at(-1)!.path).toBe('/Users/me/.ai-usage-widget/activity/claude-old_id.json')
    expect(states().at(-1)).toMatchObject({ busy: false, sessionId: 'old/id' })
  })
})

test('activityFileName', () => {
  expect(activityFileName('abc-123')).toBe('claude-abc-123.json')
  expect(activityFileName('../x')).toBe('claude-___x.json')
})

test('exportFileName', () => {
  expect(exportFileName('/Users/me/.claude')).toBe('claude.json')
  expect(exportFileName('/Users/me/.claude-work/')).toBe('claude-work.json')
  expect(exportFileName('C:\\Users\\me\\.claude')).toBe('claude.json')
})
