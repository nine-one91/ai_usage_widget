import type { Corner, Point } from '../shared/types'

import { DEFAULT_CHARACTER_SIZE } from '../shared/types'

// 위젯 창은 캐릭터 크기마다 고정 크기이고, 캐릭터는 창의 한 구석에 붙어 있다.
// 위치는 "캐릭터 중심의 화면 좌표"로 저장하고, 그 점이 화면의 어느 사분면에 있는지에 따라
// 캐릭터가 창의 어느 구석에 올지(= 카드가 어느 쪽으로 펼쳐질지)를 정한다.
export const WIDGET_WIDTH = 340
/** 카드가 쓰는 높이 (캐릭터 크기만큼 창이 더 커진다) */
const CARD_AREA_HEIGHT = 424
/** 렌더러 .root padding 과 같아야 한다 */
const PADDING = 4
/** 기본 위치에서 화면 가장자리와의 간격 */
const MARGIN = 12

export function widgetSize(characterSize = DEFAULT_CHARACTER_SIZE): { width: number; height: number } {
  return { width: Math.max(WIDGET_WIDTH, characterSize + PADDING * 2), height: CARD_AREA_HEIGHT + characterSize }
}

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
export function defaultPoint(corner: Corner, area: Rect, characterSize = DEFAULT_CHARACTER_SIZE): Point {
  const inset = MARGIN + PADDING + characterSize / 2
  return {
    x: corner.endsWith('left') ? area.x + inset : area.x + area.width - inset,
    y: corner.startsWith('top') ? area.y + inset : area.y + area.height - inset
  }
}

/** 캐릭터가 화면 밖으로 나가지 않게 */
export function clampPoint(p: Point, area: Rect, characterSize = DEFAULT_CHARACTER_SIZE): Point {
  const m = characterSize / 2 + 2
  return {
    x: Math.min(Math.max(p.x, area.x + m), area.x + area.width - m),
    y: Math.min(Math.max(p.y, area.y + m), area.y + area.height - m)
  }
}

export function widgetLayout(
  p: Point,
  area: Rect,
  characterSize = DEFAULT_CHARACTER_SIZE
): { point: Point; corner: Corner; bounds: Rect } {
  const point = clampPoint(p, area, characterSize)
  const corner = cornerFor(point, area)
  const { width, height } = widgetSize(characterSize)
  const half = characterSize / 2
  const offsetX = corner.endsWith('left') ? PADDING + half : width - PADDING - half
  const offsetY = corner.startsWith('top') ? PADDING + half : height - PADDING - half
  return {
    point,
    corner,
    bounds: { x: Math.round(point.x - offsetX), y: Math.round(point.y - offsetY), width, height }
  }
}
