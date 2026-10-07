import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { AccountConfig, Settings } from '../shared/types'
import { defaultClaudeLabel } from './providers/claudeMod'
import { defaultCodexHome } from './providers/codexLocal'

const SETTINGS_VERSION = 4

const DEFAULTS: Settings = {
  version: SETTINGS_VERSION,
  corner: 'bottom-right',
  position: null,
  alwaysExpanded: false,
  characterPack: 'default',
  accounts: []
}

export const settingsPath = () => join(app.getPath('userData'), 'settings.json')

export function newAccountId(): string {
  return randomUUID().slice(0, 8)
}

export function loadSettings(): Settings {
  if (!existsSync(settingsPath())) {
    const settings = { ...DEFAULTS, accounts: detectLocalAccounts() }
    saveSettings(settings)
    return settings
  }
  let stored: StoredSettings
  try {
    stored = { ...DEFAULTS, version: 1, ...JSON.parse(readFileSync(settingsPath(), 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
  const settings = migrate(stored)
  if (settings !== stored) saveSettings(settings)
  return settings
}

/** 예전 버전이 저장한 설정: 지금은 없는 source('cli', 'web')와 필드가 남아 있을 수 있다 */
export type StoredSettings = Omit<Settings, 'accounts'> & {
  accounts: Array<Omit<AccountConfig, 'source'> & { source: string; orgId?: string }>
  /** v3까지의 새로고침 간격 설정 */
  refreshSec?: number
}

/** 이전 형식의 설정을 지금 형식으로 바꾼다. 바뀐 게 없으면 같은 객체를 돌려준다. */
export function migrate(stored: StoredSettings): Settings {
  if (stored.version >= SETTINGS_VERSION) return stored as Settings
  // v1·v2 → v3: 토큰 API(cli)·웹 로그인(web) 방식 제거.
  // 설정 폴더가 있는 Claude 계정은 mod 기록 파일로 옮기고, 웹 로그인 계정은 지운다.
  const accounts: AccountConfig[] = []
  for (const { orgId: _orgId, ...a } of stored.accounts) {
    if (a.source === 'mod' || a.source === 'local') accounts.push(a as AccountConfig)
    else if (a.source === 'cli') accounts.push({ ...a, source: 'mod' })
  }
  // v3 → v4: 새로고침 간격 설정 제거 (파일 감시로 바로 반영되고, 다시 읽기는 1분 고정)
  const { refreshSec: _refreshSec, ...rest } = stored
  return { ...rest, version: SETTINGS_VERSION, accounts }
}

/** 없어진 웹 로그인 방식이 계정마다 남긴 브라우저 저장소(쿠키 등)를 지운다 */
export function removeLegacyLoginSessions(): void {
  const dir = join(app.getPath('userData'), 'Partitions')
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (name.startsWith('account-')) rmSync(join(dir, name), { recursive: true, force: true })
  }
}

export function saveSettings(settings: Settings): void {
  mkdirSync(dirname(settingsPath()), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}

/** 첫 실행 시 이 컴퓨터의 Claude Code 설정 폴더(~/.claude, ~/.claude-*)와 Codex 폴더를 찾아 등록한다. */
function detectLocalAccounts(): AccountConfig[] {
  const home = homedir()
  const accounts: AccountConfig[] = []

  for (const name of readdirSync(home).sort()) {
    if (!/^\.claude(-[\w.-]+)?$/.test(name)) continue
    const dir = join(home, name)
    if (!statSync(dir).isDirectory()) continue
    accounts.push({ id: newAccountId(), provider: 'claude', source: 'mod', label: defaultClaudeLabel(dir), configDir: dir })
  }

  const codexHome = defaultCodexHome()
  if (existsSync(join(codexHome, 'sessions'))) {
    accounts.push({ id: newAccountId(), provider: 'codex', source: 'local', label: 'Codex', configDir: codexHome })
  }
  return accounts
}
