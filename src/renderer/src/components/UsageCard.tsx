import { useEffect, useState } from 'react'
import { formatAgo, formatRemaining } from '../../../shared/format'
import { levelForPercent } from '../../../shared/level'
import type { UsageSnapshot, UsageWindow } from '../../../shared/types'

const SOURCE_LABEL = { mod: 'Claude Code 기록', local: 'Codex 기록' } as const

interface Props {
  snapshots: UsageSnapshot[]
  onRefresh(): void
}

export function UsageCard({ snapshots, onRefresh }: Props) {
  const now = useNow()
  return (
    <div className="card">
      <header>
        <span className="title">AI 사용량</span>
        <button className="refresh" onClick={onRefresh} title="새로고침">
          ↻
        </button>
      </header>
      {snapshots.length === 0 && <p className="empty">메뉴 막대 아이콘 → 계정에서 계정을 추가하세요</p>}
      {snapshots.map((s) => (
        <AccountRow key={s.accountId} snapshot={s} now={now} />
      ))}
    </div>
  )
}

function AccountRow({ snapshot: s, now }: { snapshot: UsageSnapshot; now: number }) {
  return (
    <section className={`account provider-${s.provider}`}>
      <div className="account-head">
        <span className="dot" />
        <span className="label">{s.label}</span>
        {s.plan && <span className="plan">{s.plan}</span>}
        <span className="source">{SOURCE_LABEL[s.source]}</span>
      </div>
      {s.status === 'loading' && <p className="message">불러오는 중…</p>}
      {s.status === 'error' && <p className="message status-error">{s.message}</p>}
      {s.status === 'ok' && s.windows.map((w) => <WindowBar key={w.key} window={w} now={now} />)}
      {s.status === 'ok' && s.updatedAt && (
        <p className="asof">{formatAgo(now - s.updatedAt)} 기준</p>
      )}
    </section>
  )
}

function WindowBar({ window: w, now }: { window: UsageWindow; now: number }) {
  const reset = w.resetPassed ? '리셋됨' : w.resetsAt ? `${formatRemaining(w.resetsAt - now)} 후 리셋` : ''
  return (
    <div className={`window level-${levelForPercent(w.percent)}`}>
      <div className="window-head">
        <span>{w.label}</span>
        <span className="percent">{Math.round(w.percent)}%</span>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${w.percent}%` }} />
      </div>
      {reset && <div className="reset">{reset}</div>}
    </div>
  )
}

/** 남은 시간이 분 단위로 바뀌는 순간을 놓치지 않도록 매초 다시 그린다 (카드가 펼쳐져 있을 때만 마운트됨) */
function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now
}
