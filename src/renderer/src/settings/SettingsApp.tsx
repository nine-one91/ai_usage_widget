import { useEffect, useState, type DragEvent } from 'react'
import { moveItem } from '../../../shared/reorder'
import { CHARACTER_SIZES, type AccountConfig, type AppInfo, type Corner, type UsageSnapshot } from '../../../shared/types'
import './settings.css'

const api = window.settingsApi

const CORNERS: Array<[Corner, string]> = [
  ['top-left', '왼쪽 위'],
  ['top-right', '오른쪽 위'],
  ['bottom-left', '왼쪽 아래'],
  ['bottom-right', '오른쪽 아래']
]

const SOURCE_LABEL = { mod: 'Claude Code 기록 (mod)', local: 'Codex 기록 파일' } as const

export function SettingsApp() {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    document.body.classList.add('settings-body')
    void api.get().then(setInfo)
    return api.onChange(setInfo)
  }, [])

  if (!info) return null
  const { settings } = info

  return (
    <div className="settings">
      <h1>설정</h1>

      <section>
        <h2>일반</h2>
        <div className="group">
          <Row
            label="로그인 시 자동 실행"
            hint={info.isPackaged ? undefined : '개발 모드에서는 Electron 앱이 등록돼요'}
          >
            <Toggle checked={info.openAtLogin} onChange={(v) => void api.setOpenAtLogin(v)} />
          </Row>
          <Row label="항상 펼쳐두기" hint="끄면 캐릭터에 마우스를 올렸을 때만 보여요">
            <Toggle checked={settings.alwaysExpanded} onChange={(v) => void api.update({ alwaysExpanded: v })} />
          </Row>
        </div>
      </section>

      <section>
        <h2>위치</h2>
        <div className="group">
          <Row
            label="기본 위치"
            hint={
              settings.position ? '지금은 드래그로 옮긴 위치에 있어요' : '캐릭터를 끌어서 원하는 곳으로 옮길 수 있어요'
            }
          >
            <select
              value={settings.corner}
              onChange={(e) => void api.update({ corner: e.target.value as Corner, position: null })}
            >
              {CORNERS.map(([corner, label]) => (
                <option key={corner} value={corner}>
                  {label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="위치 초기화" hint="드래그한 위치를 지우고 기본 위치로 돌아가요">
            <button disabled={!settings.position} onClick={() => void api.resetPosition()}>
              초기화
            </button>
          </Row>
        </div>
      </section>

      <section>
        <h2>캐릭터</h2>
        <div className="group">
          <Row label="캐릭터" hint="폴더에 busy.gif(작업 중) / idle.gif(쉬는 중) 등을 넣은 팩을 추가할 수 있어요">
            <select value={settings.characterPack} onChange={(e) => void api.update({ characterPack: e.target.value })}>
              <option value="default">기본</option>
              {info.characterPacks.map((pack) => (
                <option key={pack} value={pack}>
                  {pack}
                </option>
              ))}
            </select>
            <button onClick={() => void api.openCharactersFolder()}>폴더 열기</button>
          </Row>
          <Row label="크기" hint="화면 구석에 떠 있는 캐릭터의 크기">
            <select
              value={settings.characterSize}
              onChange={(e) => void api.update({ characterSize: Number(e.target.value) })}
            >
              {CHARACTER_SIZES.map(([size, label]) => (
                <option key={size} value={size}>
                  {label} ({size}px)
                </option>
              ))}
            </select>
          </Row>
        </div>
      </section>

      <section>
        <h2>계정</h2>
        {settings.accounts.length === 0 && <p className="hint">등록된 계정이 없어요</p>}
        {settings.accounts.length > 0 && <AccountList accounts={settings.accounts} snapshots={info.snapshots} />}
        <div className="add-buttons">
          <button onClick={() => void api.addFolder('claude')}>+ Claude Code 폴더</button>
          <button onClick={() => void api.addFolder('codex')}>+ Codex 폴더</button>
        </div>
      </section>
    </div>
  )
}

/** 손잡이를 끌거나 ▲▼로 순서를 바꾼다. 위젯 카드도 이 순서를 따른다. */
function AccountList({ accounts, snapshots }: { accounts: AccountConfig[]; snapshots: UsageSnapshot[] }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const move = (from: number, to: number) => {
    const next = moveItem(accounts, from, to)
    if (next.some((a, i) => a.id !== accounts[i].id)) void api.reorderAccounts(next.map((a) => a.id))
  }

  const onDragOver = (index: number) => (e: DragEvent) => {
    if (dragIndex === null) return
    e.preventDefault()
    setOverIndex(index)
  }
  const onDrop = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    if (dragIndex !== null) move(dragIndex, index)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="group">
      {accounts.map((account, index) => (
        <AccountItem
          key={account.id}
          account={account}
          snapshot={snapshots.find((s) => s.accountId === account.id)}
          dragging={dragIndex === index}
          dropTarget={overIndex === index && dragIndex !== index ? (dragIndex! < index ? 'below' : 'above') : undefined}
          onDragStart={(e) => {
            setDragIndex(index)
            e.dataTransfer.effectAllowed = 'move'
            // 손잡이만이 아니라 줄 전체가 끌려가는 모습으로
            const row = (e.currentTarget as HTMLElement).closest('.account-item')
            if (row) e.dataTransfer.setDragImage(row, 16, 16)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
          onDragOver={onDragOver(index)}
          onDrop={onDrop(index)}
          onMoveUp={index > 0 ? () => move(index, index - 1) : undefined}
          onMoveDown={index < accounts.length - 1 ? () => move(index, index + 1) : undefined}
        />
      ))}
    </div>
  )
}

interface AccountItemProps {
  account: AccountConfig
  snapshot?: UsageSnapshot
  dragging: boolean
  dropTarget?: 'above' | 'below'
  onDragStart(e: DragEvent): void
  onDragEnd(): void
  onDragOver(e: DragEvent): void
  onDrop(e: DragEvent): void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function AccountItem({ account, snapshot, dragging, dropTarget, ...props }: AccountItemProps) {
  const [label, setLabel] = useState(account.label)
  useEffect(() => setLabel(account.label), [account.label])

  const status =
    snapshot?.status === 'ok' ? '정상' : snapshot?.status === 'loading' ? '불러오는 중' : (snapshot?.message ?? '')

  return (
    <div
      className={`account-item provider-${account.provider}${dragging ? ' dragging' : ''}${dropTarget ? ` drop-${dropTarget}` : ''}`}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      <span
        className="drag-handle"
        draggable
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
        title="끌어서 순서 바꾸기"
      >
        ⠿
      </span>
      <span className="dot" />
      <div className="account-main">
        <input
          className="account-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== account.label && void api.renameAccount(account.id, label)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <div className="account-meta">
          {SOURCE_LABEL[account.source]}
          {account.configDir && ` · ${account.configDir}`}
        </div>
        {status && <div className={`account-status status-${snapshot?.status}`}>{status}</div>}
      </div>
      <div className="account-actions">
        <button className="order" disabled={!props.onMoveUp} onClick={props.onMoveUp} title="위로">
          ▲
        </button>
        <button className="order" disabled={!props.onMoveDown} onClick={props.onMoveDown} title="아래로">
          ▼
        </button>
        <button
          className="danger"
          onClick={() => confirm(`'${account.label}' 계정을 삭제할까요?`) && void api.removeAccount(account.id)}
        >
          삭제
        </button>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <div>
        <div className="row-label">{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  )
}
