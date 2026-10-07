import { describe, expect, it } from 'vitest'
import { formatAgo, formatRemaining } from '../src/shared/format'

const s = 1000
const m = 60 * s
const h = 60 * m

describe('formatRemaining (올림, Claude Desktop과 같게)', () => {
  it('남은 초가 있으면 다음 분으로 올린다', () => {
    expect(formatRemaining(3 * h + 27 * m + 10 * s)).toBe('3시간 28분')
    expect(formatRemaining(3 * h + 28 * m)).toBe('3시간 28분')
    expect(formatRemaining(30 * s)).toBe('1분')
  })
  it('하루 이상, 0 이하', () => {
    expect(formatRemaining(2 * 24 * h + 21 * h + 5 * m)).toBe('2일 21시간')
    expect(formatRemaining(-5 * s)).toBe('0분')
  })
})

describe('formatAgo (다 채운 분만)', () => {
  it('1분 미만은 방금', () => {
    expect(formatAgo(59 * s)).toBe('방금')
  })
  it('남은 초는 버린다', () => {
    expect(formatAgo(8 * m + 50 * s)).toBe('8분 전')
    expect(formatAgo(h + 2 * m)).toBe('1시간 2분 전')
  })
})
