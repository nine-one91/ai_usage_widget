import type { AccountConfig, UsageSnapshot } from '../../shared/types'

export type UsageFetcher = (account: AccountConfig) => Promise<UsageSnapshot>

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
