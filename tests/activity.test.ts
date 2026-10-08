import { describe, expect, it } from 'vitest'
import {
  CLAUDE_ACTIVITY_STALE_MS,
  codexTaskRunning,
  isClaudeActivityLive,
  parseClaudeActivity
} from '../src/main/parsers/activity'

const ev = (type: string, extra: object = {}) =>
  JSON.stringify({ timestamp: '2026-10-08T05:00:00Z', type: 'event_msg', payload: { type, turn_id: 't', ...extra } })
const item = JSON.stringify({ type: 'response_item', payload: { type: 'message', content: 'task_complete 라는 글자' } })

describe('codexTaskRunning', () => {
  it('마지막 표시가 task_started면 진행 중', () => {
    expect(codexTaskRunning([ev('task_started'), ev('token_count'), item, ''].join('\n'))).toBe(true)
  })

  it('task_complete / turn_aborted면 끝남', () => {
    expect(codexTaskRunning([ev('task_started'), item, ev('task_complete')].join('\n'))).toBe(false)
    expect(codexTaskRunning([ev('task_started'), ev('turn_aborted', { reason: 'interrupted' })].join('\n'))).toBe(false)
  })

  it('끝난 뒤 새 턴이 시작되면 다시 진행 중', () => {
    expect(codexTaskRunning([ev('task_started'), ev('task_complete'), ev('task_started')].join('\n'))).toBe(true)
  })

  it('메시지 본문에 같은 글자가 있어도 속지 않는다', () => {
    expect(codexTaskRunning([ev('task_started'), item].join('\n'))).toBe(true)
  })

  it('표시가 없으면 null, 잘린 마지막 줄은 건너뛴다', () => {
    expect(codexTaskRunning([item, ev('token_count')].join('\n'))).toBeNull()
    expect(codexTaskRunning([ev('task_started'), '{"type":"event_msg","payload":{"type":"task_comp'].join('\n'))).toBe(true)
  })
})

describe('Claude activity', () => {
  const file = (patch: object) =>
    JSON.stringify({ version: 1, configDir: '/Users/me/.claude', sessionId: 's1', busy: true, updatedAt: 1_000, ...patch })

  it('파일을 읽는다', () => {
    expect(parseClaudeActivity(file({}))).toEqual({ configDir: '/Users/me/.claude', busy: true, updatedAt: 1_000 })
    expect(parseClaudeActivity(file({ version: 2 }))).toBeNull()
    expect(parseClaudeActivity('{"version":1,"conf')).toBeNull()
  })

  it('작업 중이어도 갱신이 끊기면 (강제 종료) 쉬는 것으로 본다', () => {
    const a = parseClaudeActivity(file({}))!
    expect(isClaudeActivityLive(a, 1_000 + 30_000)).toBe(true)
    expect(isClaudeActivityLive(a, 1_000 + CLAUDE_ACTIVITY_STALE_MS)).toBe(false)
    expect(isClaudeActivityLive(parseClaudeActivity(file({ busy: false }))!, 1_000)).toBe(false)
  })
})
