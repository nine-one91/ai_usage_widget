import { useEffect, useState, type HTMLAttributes } from 'react'
import type { Level } from '../../../shared/types'

interface Props extends HTMLAttributes<HTMLDivElement> {
  level: Level
  pack: string
  dragging?: boolean
}

/**
 * 사용량 상태에 따라 모습과 애니메이션이 바뀌는 캐릭터.
 * pack이 'default'가 아니면 character://<pack>/<level> 이미지를 쓰고, 없으면 내장 캐릭터로 대신한다.
 */
export function Character({ level, pack, dragging, ...handlers }: Props) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [pack, level])

  const useImage = pack !== 'default' && !imageFailed
  return (
    <div
      className={`character level-${level}${dragging ? ' dragging' : ''}`}
      title={dragging ? undefined : LEVEL_TITLE[level]}
      {...handlers}
    >
      {useImage ? (
        <img src={`character://${pack}/${level}`} alt="" draggable={false} onError={() => setImageFailed(true)} />
      ) : (
        <DefaultCharacter level={level} />
      )}
    </div>
  )
}

const LEVEL_TITLE: Record<Level, string> = {
  unknown: '사용량 정보 없음',
  calm: '여유 있어요',
  normal: '절반 넘게 썼어요',
  warn: '한도에 가까워요',
  limit: '한도에 도달했어요'
}

const MOUTH: Record<Level, string> = {
  unknown: 'M22 41 h12',
  calm: 'M20 39 q8 7 16 0',
  normal: 'M21 40 q7 3 14 0',
  warn: 'M21 42 q7 -3 14 0',
  limit: 'M20 43 q8 -7 16 0'
}

function DefaultCharacter({ level }: { level: Level }) {
  return (
    <svg viewBox="0 0 56 56" className="blob" aria-hidden>
      <path className="body" d="M28 4c14 0 24 10 24 25 0 13-10 23-24 23S4 42 4 29C4 14 14 4 28 4z" />
      <ellipse className="cheek" cx="15" cy="34" rx="4" ry="2.5" />
      <ellipse className="cheek" cx="41" cy="34" rx="4" ry="2.5" />
      {level === 'limit' ? (
        <g className="eye-x">
          <path d="M16 23l6 6M22 23l-6 6M34 23l6 6M40 23l-6 6" />
        </g>
      ) : (
        <g className="eyes">
          <ellipse cx="20" cy="27" rx="3" ry={level === 'warn' ? 2 : 3.5} />
          <ellipse cx="36" cy="27" rx="3" ry={level === 'warn' ? 2 : 3.5} />
        </g>
      )}
      <path className="mouth" d={MOUTH[level]} />
      {(level === 'warn' || level === 'limit') && <path className="sweat" d="M47 12c2 3 3 5 3 6.5a3 3 0 0 1-6 0c0-1.5 1-3.5 3-6.5z" />}
    </svg>
  )
}
