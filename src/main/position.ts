import type { Corner, Point } from '../shared/types'

// 위젯 창은 고정 크기이고, 캐릭터는 창의 한 구석에 붙어 있다.
// 위치는 "캐릭터 중심의 화면 좌표"로 저장하고, 그 점이 화면의 어느 사분면에 있는지에 따라
// 캐릭터가 창의 어느 구석에 올지(= 카드가 어느 쪽으로 펼쳐질지)를 정한다.
export const WIDGET_WIDTH = 340
export const WIDGET_HEIGHT = 480
/** 렌더러 .root padding 과 같아야 한다 */
const PADDING = 4
/** 렌더러 .character 크기의 절반 */
const HALF = 28
/** 기본 위치에서 화면 가장자리와의 간격 */
const MARGIN = 12

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function cornerFor(p: Point, area: Rect): Corner {
  const top = p.y < area.y + area.height / 2
  const left = p.x < area.x + area.width / 2
  return `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`
}

/** 구석 기본 위치의 캐릭터 중심 */
export function defaultPoint(corner: Corner, area: Rect): Point {
  const inset = MARGIN + PADDING + HALF
  return {
    x: corner.endsWith('left') ? area.x + inset : area.x + area.width - inset,
    y: corner.startsWith('top') ? area.y + inset : area.y + area.height - inset
  }
}

/** 캐릭터가 화면 밖으로 나가지 않게 */
export function clampPoint(p: Point, area: Rect): Point {
  const m = HALF + 2
  return {
    x: Math.min(Math.max(p.x, area.x + m), area.x + area.width - m),
    y: Math.min(Math.max(p.y, area.y + m), area.y + area.height - m)
  }
}

export function widgetLayout(p: Point, area: Rect): { point: Point; corner: Corner; bounds: Rect } {
  const point = clampPoint(p, area)
  const corner = cornerFor(point, area)
  const offsetX = corner.endsWith('left') ? PADDING + HALF : WIDGET_WIDTH - PADDING - HALF
  const offsetY = corner.startsWith('top') ? PADDING + HALF : WIDGET_HEIGHT - PADDING - HALF
  return {
    point,
    corner,
    bounds: {
      x: Math.round(point.x - offsetX),
      y: Math.round(point.y - offsetY),
      width: WIDGET_WIDTH,
      height: WIDGET_HEIGHT
    }
  }
}
