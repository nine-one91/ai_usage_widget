import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { WidgetState } from '../../shared/types'
import { Character } from './components/Character'
import { UsageCard } from './components/UsageCard'

const COLLAPSE_DELAY_MS = 250
/** 이만큼 움직여야 클릭이 아니라 드래그로 본다 */
const DRAG_THRESHOLD_PX = 4

export function App() {
  const [state, setState] = useState<WidgetState | null>(null)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const leaveTimer = useRef<number>(undefined)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const hitRef = useRef<HTMLDivElement>(null)

  useEffect(() => window.widget.onState(setState), [])

  // 투명 영역은 클릭 통과. 캐릭터/카드 위에 있을 때만 마우스를 받는다.
  const onEnter = () => {
    window.clearTimeout(leaveTimer.current)
    window.widget.setInteractive(true)
    setHovered(true)
  }
  const onLeave = () => {
    if (pressStart.current) return // 드래그 중에는 커서가 잠깐 벗어나도 유지
    window.widget.setInteractive(false)
    leaveTimer.current = window.setTimeout(() => setHovered(false), COLLAPSE_DELAY_MS)
  }

  // 캐릭터를 끌어서 옮긴다. 창 위치는 main이 실제 커서 좌표로 계산한다.
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pressStart.current = { x: e.screenX, y: e.screenY }
  }
  const onPointerMove = (e: PointerEvent) => {
    const start = pressStart.current
    if (!start) return
    if (!dragging) {
      if (Math.hypot(e.screenX - start.x, e.screenY - start.y) < DRAG_THRESHOLD_PX) return
      setDragging(true)
      window.widget.dragStart()
    }
    window.widget.dragMove()
  }
  const onPointerUp = () => {
    pressStart.current = null
    if (dragging) {
      setDragging(false)
      window.widget.dragEnd()
    }
    // 드래그 중 놓친 mouseleave 처리
    if (!hitRef.current?.matches(':hover')) onLeave()
  }

  if (!state) return null
  const expanded = (state.alwaysExpanded || hovered) && !dragging

  return (
    <div className={`root corner-${state.corner}`}>
      <div
        ref={hitRef}
        className="hit"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onContextMenu={(e) => {
          e.preventDefault()
          window.widget.openMenu()
        }}
      >
        {expanded && <UsageCard snapshots={state.snapshots} onRefresh={() => window.widget.refresh()} />}
        <Character
          level={state.level}
          busy={state.busy}
          size={state.characterSize}
          pack={state.characterPack}
          dragging={dragging}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  )
}
