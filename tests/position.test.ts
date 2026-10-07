import { describe, expect, it } from 'vitest'
import { moveItem } from '../src/shared/reorder'
import { WIDGET_HEIGHT, WIDGET_WIDTH, clampPoint, cornerFor, defaultPoint, widgetLayout } from '../src/main/position'

const AREA = { x: 0, y: 25, width: 1920, height: 1055 }

describe('widgetLayout', () => {
  it('오른쪽 아래 사분면이면 캐릭터가 창의 오른쪽 아래에 오고 카드는 왼쪽 위로 펼쳐진다', () => {
    const { corner, bounds } = widgetLayout({ x: 1800, y: 1000 }, AREA)
    expect(corner).toBe('bottom-right')
    expect(bounds).toEqual({ x: 1800 - (WIDGET_WIDTH - 32), y: 1000 - (WIDGET_HEIGHT - 32), width: WIDGET_WIDTH, height: WIDGET_HEIGHT })
  })

  it('왼쪽 위 사분면이면 카드가 오른쪽 아래로 펼쳐진다', () => {
    const { corner, bounds } = widgetLayout({ x: 100, y: 100 }, AREA)
    expect(corner).toBe('top-left')
    expect(bounds).toMatchObject({ x: 100 - 32, y: 100 - 32 })
  })

  it('창은 항상 화면 안쪽으로 펼쳐진다', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 5000, y: 5000 }, { x: 961, y: 553 }, { x: 959, y: 551 }]) {
      const { bounds } = widgetLayout(p, AREA)
      expect(bounds.x).toBeGreaterThanOrEqual(AREA.x - 4)
      expect(bounds.y).toBeGreaterThanOrEqual(AREA.y - 4)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(AREA.x + AREA.width + 4)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(AREA.y + AREA.height + 4)
    }
  })

  it('다른 모니터(음수 좌표)에서도 동작한다', () => {
    const left = { x: -1080, y: 0, width: 1080, height: 1920 }
    expect(widgetLayout({ x: -1000, y: 1800 }, left).corner).toBe('bottom-left')
  })
})

describe('clampPoint / defaultPoint / cornerFor', () => {
  it('화면 밖 좌표는 캐릭터가 다 보이게 당긴다', () => {
    expect(clampPoint({ x: -50, y: 9999 }, AREA)).toEqual({ x: 30, y: 25 + 1055 - 30 })
  })

  it('기본 위치는 해당 구석이고 같은 구석으로 판정된다', () => {
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      expect(cornerFor(defaultPoint(corner, AREA), AREA)).toBe(corner)
    }
    expect(defaultPoint('bottom-right', AREA)).toEqual({ x: 1920 - 44, y: 25 + 1055 - 44 })
  })
})

describe('moveItem', () => {
  it('항목을 위아래로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 1, 0)).toEqual(['b', 'a', 'c'])
  })
  it('범위를 벗어나면 그대로', () => {
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })
})
