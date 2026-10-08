import type { AccountConfig, UsageSnapshot } from '../../shared/types'

export type UsageFetcher = (account: AccountConfig) => Promise<UsageSnapshot>

/** 이 계정으로 지금 작업 중(턴 진행 중)인 세션이 있는지 */
export type BusyChecker = (account: AccountConfig) => Promise<boolean>

export function snapshot(account: AccountConfig, patch: Partial<UsageSnapshot>): UsageSnapshot {
  return {
    accountId: account.id,
    provider: account.provider,
    source: account.source,
    label: account.label,
    windows: [],
    status: 'ok',
    updatedAt: null,
    ...patch
  }
}
