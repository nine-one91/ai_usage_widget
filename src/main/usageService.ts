import type { FSWatcher } from 'node:fs'
import type { AccountConfig, UsageSnapshot } from '../shared/types'
import { fetchClaudeModUsage, watchModExports } from './providers/claudeMod'
import { fetchCodexLocalUsage, watchCodexSessions } from './providers/codexLocal'
import { snapshot, type UsageFetcher } from './providers/types'

const FETCHERS: Record<AccountConfig['source'], UsageFetcher> = {
  mod: fetchClaudeModUsage,
  local: fetchCodexLocalUsage
}

/**
 * 기록 파일은 바뀌면 파일 감시로 바로 다시 읽는다. 이 간격은 그 밖의 경우용이다:
 * 파일이 그대로여도 리셋 시각이 지나면 0%로 바꿔야 하고, 감시가 변경을 놓칠 수도 있다.
 */
const REREAD_INTERVAL_MS = 60_000

/** 계정들의 기록 파일을 읽고, 결과가 바뀔 때마다 onUpdate를 부른다. */
export class UsageService {
  private accounts: AccountConfig[] = []
  private snapshots = new Map<string, UsageSnapshot>()
  private watchers: FSWatcher[] = []
  private timer: NodeJS.Timeout | undefined

  constructor(private onUpdate: (snapshots: UsageSnapshot[]) => void) {}

  configure(accounts: AccountConfig[]): void {
    this.stop()
    this.accounts = accounts
    const ids = new Set(accounts.map((a) => a.id))
    for (const id of this.snapshots.keys()) if (!ids.has(id)) this.snapshots.delete(id)
    for (const a of accounts) {
      if (!this.snapshots.has(a.id)) this.snapshots.set(a.id, snapshot(a, { status: 'loading' }))
      if (a.source === 'local') {
        const w = watchCodexSessions(a, () => void this.refreshAccount(a))
        if (w) this.watchers.push(w)
      }
    }
    // mod 파일은 한 폴더에 모이므로 감시도 하나로 충분하다
    const modAccounts = accounts.filter((a) => a.source === 'mod')
    if (modAccounts.length > 0) {
      const w = watchModExports(() => modAccounts.forEach((a) => void this.refreshAccount(a)))
      if (w) this.watchers.push(w)
    }
    this.emit()
    void this.refreshAll()
    this.timer = setInterval(() => void this.refreshAll(), REREAD_INTERVAL_MS)
  }

  async refreshAll(): Promise<void> {
    await Promise.all(this.accounts.map((a) => this.refreshAccount(a)))
  }

  private async refreshAccount(account: AccountConfig): Promise<void> {
    const next = await FETCHERS[account.source](account)
    if (!this.accounts.some((a) => a.id === account.id)) return // 조회 중에 삭제됨
    this.snapshots.set(account.id, next)
    this.emit()
  }

  current(): UsageSnapshot[] {
    return this.accounts.map((a) => this.snapshots.get(a.id)).filter((s): s is UsageSnapshot => !!s)
  }

  private emit(): void {
    this.onUpdate(this.current())
  }

  stop(): void {
    clearInterval(this.timer)
    this.watchers.forEach((w) => w.close())
    this.watchers = []
  }
}
