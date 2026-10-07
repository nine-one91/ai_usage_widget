import { describe, expect, it } from 'vitest'
import { modExportFileName, parseModExport } from '../src/main/parsers/claudeMod'
import { migrate, type StoredSettings } from '../src/main/settings'

const NOW = Date.parse('2026-10-07T07:00:00Z')

// mod가 실제로 남긴 파일 (Desktop Code 탭, 2026-10-07)
const EXPORT = JSON.stringify({
  version: 1,
  configDir: '/Users/me/.claude',
  updatedAt: 1791355557469,
  rateLimits: [
    { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-07T10:40:00.000Z' },
    { kind: 'seven_day', percentUsed: 21, resetsAt: '2026-10-10T05:00:00.000Z' }
  ]
})

describe('parseModExport', () => {
  it('한도와 기록 시각을 읽는다', () => {
    expect(parseModExport(EXPORT, NOW)).toEqual({
      updatedAt: 1791355557469,
      windows: [
        { key: 'five_hour', label: '5시간', percent: 5, resetsAt: Date.parse('2026-10-07T10:40:00.000Z') },
        { key: 'seven_day', label: '주간', percent: 21, resetsAt: Date.parse('2026-10-10T05:00:00.000Z') }
      ]
    })
  })

  it('리셋 시각이 지난 한도는 0%', () => {
    const later = Date.parse('2026-10-07T11:00:00Z')
    expect(parseModExport(EXPORT, later).windows[0]).toMatchObject({ percent: 0, resetPassed: true, resetsAt: null })
  })

  it('모르는 버전이나 잘린 파일은 에러', () => {
    expect(() => parseModExport(JSON.stringify({ version: 2, updatedAt: 1 }), NOW)).toThrow()
    expect(() => parseModExport('{"version":1,"upd', NOW)).toThrow()
  })

  it('모르는 kind는 이름 그대로 보여준다', () => {
    const text = JSON.stringify({ version: 1, updatedAt: 1, rateLimits: [{ kind: 'new_window', percentUsed: 3 }] })
    expect(parseModExport(text, NOW).windows).toEqual([{ key: 'new_window', label: 'new_window', percent: 3, resetsAt: null }])
  })
})

it('설정 폴더 이름으로 파일 이름을 정한다 (mod와 같은 규칙)', () => {
  expect(modExportFileName('/Users/me/.claude')).toBe('claude.json')
  expect(modExportFileName('/Users/me/.claude-personal/')).toBe('claude-personal.json')
  expect(modExportFileName('C:\\Users\\me\\.claude-work')).toBe('claude-work.json')
})

describe('migrate', () => {
  const v1: StoredSettings = {
    version: 1,
    corner: 'bottom-right',
    position: null,
    alwaysExpanded: false,
    refreshSec: 120,
    characterPack: 'default',
    accounts: [
      { id: 'a', provider: 'claude', source: 'cli', label: 'Claude', configDir: '/h/.claude' },
      { id: 'b', provider: 'claude', source: 'web', label: 'Team', orgId: 'o' },
      { id: 'c', provider: 'codex', source: 'local', label: 'Codex' },
      { id: 'd', provider: 'claude', source: 'mod', label: 'P', configDir: '/h/.claude-p' }
    ]
  }

  it('cli 계정은 mod로 옮기고 web 계정은 지운다', () => {
    const next = migrate(v1)
    expect(next.version).toBe(4)
    expect(next).not.toHaveProperty('refreshSec')
    expect(next.accounts.map((a) => [a.id, a.source])).toEqual([
      ['a', 'mod'],
      ['c', 'local'],
      ['d', 'mod']
    ])
  })

  it('v2에서 다시 cli를 골랐던 계정도 mod로 옮긴다', () => {
    expect(migrate({ ...v1, version: 2 }).accounts[0].source).toBe('mod')
  })

  it('v3의 새로고침 간격 설정은 지운다', () => {
    const next = migrate({ ...v1, version: 3, accounts: [] })
    expect(next).toMatchObject({ version: 4, accounts: [] })
    expect(next).not.toHaveProperty('refreshSec')
  })

  it('이미 v4면 그대로', () => {
    const { refreshSec: _r, ...v4 } = { ...v1, version: 4, accounts: [] }
    expect(migrate(v4)).toBe(v4)
  })
})
