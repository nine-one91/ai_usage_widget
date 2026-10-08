import { useEffect, useState, type HTMLAttributes } from 'react'
import type { Level } from '../../../shared/types'

interface Props extends HTMLAttributes<HTMLDivElement> {
  level: Level
  /** 작업 중인 세션이 하나라도 있으면 true — 고양이가 뛴다 */
  busy: boolean
  pack: string
  /** 한 변 크기 (px) */
  size: number
  dragging?: boolean
}

/**
 * 작업 중이면 달리고, 쉬면 몸을 말고 자는 고양이. 사용량 단계는 목걸이 색과 땀방울로 보여준다.
 * pack이 'default'가 아니면 character://<pack>/<busy|idle> → character://<pack>/<level> 순서로 이미지를 찾고,
 * 둘 다 없으면 내장 고양이로 대신한다.
 */
export function Character({ level, busy, pack, size, dragging, ...handlers }: Props) {
  const activity = busy ? 'busy' : 'idle'
  const candidates = pack === 'default' ? [] : [activity, level]
  const [failed, setFailed] = useState(0)
  useEffect(() => setFailed(0), [pack, level, activity])

  const image = candidates[failed]
  const title = dragging ? undefined : `${busy ? '작업 중이에요' : '쉬는 중이에요'} · ${LEVEL_TITLE[level]}`
  return (
    <div
      className={`character level-${level} ${activity}${image === level && busy ? ' hop' : ''}${dragging ? ' dragging' : ''}`}
      title={title}
      style={{ width: size, height: size }}
      {...handlers}
    >
      {image ? (
        <img
          key={image}
          src={`character://${pack}/${image}`}
          alt=""
          draggable={false}
          onError={() => setFailed((n) => n + 1)}
        />
      ) : busy ? (
        <RunningCat level={level} />
      ) : (
        <SleepingCat level={level} />
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

const Sweat = ({ x, y }: { x: number; y: number }) => (
  <path className="sweat" d={`M${x} ${y}c4 6 6 10 6 13a6 6 0 0 1-12 0c0-3 2-7 6-13z`} />
)

type Pt = [number, number]

/**
 * 관절이 있는 다리: 엉덩이(hip)에서 허벅지가, 무릎(knee)에서 정강이+발이 따로 돈다.
 * 회전 중심은 viewBox 좌표로 준다 (.cat .thigh / .shin 은 transform-box: view-box).
 */
const Leg = ({ hip, knee, paw, className }: { hip: Pt; knee: Pt; paw: Pt; className: string }) => {
  const thigh = `M${hip[0]} ${hip[1]}L${knee[0]} ${knee[1]}`
  const shin = `M${knee[0]} ${knee[1]}L${paw[0]} ${paw[1] - 1}`
  return (
    <g className={`thigh ${className}`} style={{ transformOrigin: `${hip[0]}px ${hip[1]}px` }}>
      <path className="limb-ol" d={thigh} />
      <g className="shin" style={{ transformOrigin: `${knee[0]}px ${knee[1]}px` }}>
        <path className="limb-ol" d={shin} />
        <path className="limb" d={shin} />
        <ellipse className="paw" cx={paw[0] + 1} cy={paw[1]} rx="4.6" ry="3.2" />
      </g>
      {/* 허벅지 털을 정강이 위에 덮어 무릎 이음새를 감춘다 */}
      <path className="limb" d={thigh} />
    </g>
  )
}

/**
 * 옆모습으로 오른쪽을 향해 전력질주(갤럽)한다. 한 주기:
 * 뒷발 착지 → 뒷발 차기 + 앞발 착지(몸이 가장 길고 낮음) → 앞발 차기 → 네 발을 몸 아래 모으고 공중(가장 높음).
 * 무릎이 접히고, 척추가 늘었다 줄고, 꼬리는 한 박자 늦게 따라온다. 뒤로 속도선과 먼지가 날린다.
 */
function RunningCat({ level }: { level: Level }) {
  return (
    <svg viewBox="0 0 128 112" className="cat running" aria-hidden>
      <g className="speed">
        <path d="M4 40h14" />
        <path d="M0 54h12" />
        <path d="M6 68h10" />
      </g>
      <g className="dust">
        <circle cx="30" cy="97" r="4.5" />
        <circle cx="20" cy="93" r="3.2" />
        <circle cx="35" cy="89" r="2.4" />
      </g>
      <g className="gallop">
        <g className="tail">
          <path className="limb-ol" d="M40 53C30 51 21 45 13 35" />
          <path className="limb" d="M40 53C30 51 21 45 13 35" />
          <path className="limb tip" d="M17 40.5C15.5 38.8 14.2 37 13 35" />
        </g>
        {/* 먼 쪽 다리는 조금 어둡게, 반 박자 늦게 (고양이 질주는 좌우 다리가 엇갈린다) */}
        <g className="hind-legs">
          <Leg className="hind far" hip={[50, 62]} knee={[50, 76]} paw={[53, 88]} />
          <Leg className="hind" hip={[44, 62]} knee={[44, 76]} paw={[47, 88]} />
        </g>
        <g className="fore-legs">
          <Leg className="fore far" hip={[85, 61]} knee={[85, 75]} paw={[87, 88]} />
          <Leg className="fore" hip={[79, 62]} knee={[79, 76]} paw={[81, 88]} />
        </g>
        <path className="fur torso" d="M36 58C36 46 48 40 64 40C80 40 91 45 93 55C95 66 84 72 68 72C54 72 36 70 36 58Z" />
        <path className="cream torso" d="M45 66.5C53 71 67 72 81 68.5C75 71.5 67 72.6 60 72.6C52.5 72.6 47.5 70.3 45 66.5Z" />
        <path className="shine torso" d="M48 45.5C56 42 70 41.5 79 43.5" />
        <path className="stripe torso" d="M55 41.5q2.5 6 -.5 10.5M63.5 40.5q2.5 6.5 -.5 11.5M72 41.3q2.5 5.5 -.5 9.7" />
        <g className="head">
          <path className="fur" d="M84 35C84 27 86 19 88.5 14C94 18 99 23 102 28Z" />
          <path className="fur" d="M101.5 27C106 22 111.5 17.5 117 14.5C119 20.5 119.5 28 117.5 36Z" />
          <path className="ear-in" d="M87.5 30C87.5 25.5 88.5 21.5 89.5 19C93 22 95.8 25 97.8 28Z" />
          <path className="ear-in" d="M105.5 27C108.3 24.3 111.2 21.8 114 20C115 24 115.2 28.4 114.4 32Z" />
          <path className="fur" d="M78 46C78 32 88 26 99 26C111 26 120 33 120 44C120 54 112 61 100 61C94 61 90 60 86.5 58.5L82 60.5L83 55.5C80 53 78 50 78 46Z" />
          <ellipse className="cream" cx="110.5" cy="50.5" rx="8" ry="6" />
          <path className="stripe thin" d="M95.5 27.5v5M100.5 26.8v6M105.5 27.6v5" />
          <ellipse className="eye-ol" cx="106" cy="41" rx="4.6" ry="6" />
          <ellipse className="iris" cx="106.4" cy="42" rx="3.3" ry="4.6" />
          <ellipse className="pupil" cx="106.8" cy="42.6" rx="1.7" ry="3.1" />
          <circle className="glint" cx="104.7" cy="38.8" r="1.6" />
          <circle className="glint" cx="108" cy="45.2" r="0.8" />
          <ellipse className="cheek" cx="103.5" cy="52" rx="4" ry="2.2" />
          <path className="nose" d="M116.3 46.2l3.6-.6-1.7 2.7z" />
          <path className="mouth" d="M113.6 50.6q2.3 4.2 4.8 0z" />
          <path className="whisker" d="M113 48.5l12-1.5M113 51l11 2.6" />
          <path className="collar" d="M82.5 54.5C88 60.5 96 62.5 102.5 60.5" />
          <circle className="bell" cx="92" cy="62.2" r="2.8" />
        </g>
        {(level === 'warn' || level === 'limit') && <Sweat x={78} y={16} />}
      </g>
    </svg>
  )
}

/** 몸을 말고 잔다: 천천히 숨 쉬고 z가 떠오른다 */
function SleepingCat({ level }: { level: Level }) {
  return (
    <svg viewBox="0 0 128 112" className="cat sleeping" aria-hidden>
      <g className="zzz">
        <text x="104" y="42">z</text>
        <text x="114" y="26">z</text>
      </g>
      <g className="breathe">
        <path className="fur" d="M18 97C16 74 32 58 56 58C76 58 92 66 98 82L100 97Z" />
        <path className="shine" d="M30 72C35 65 43 61.5 52 60.5" />
        <path className="stripe" d="M40 61.5q3 7 0 13M50 59.6q3 7 0 14M60 60q3 7 0 13" />
        <g className="tail">
          <path className="limb-ol" d="M23 92C25 105 55 108 73 100.5" />
          <path className="limb" d="M23 92C25 105 55 108 73 100.5" />
          <path className="limb tip" d="M66.5 103C68.8 102.3 71 101.5 73 100.5" />
        </g>
        <path className="fur" d="M74 67C74 59 76 53 78.5 48.5C84 52 88 56 91 60Z" />
        <path className="fur" d="M91.5 59.5C96.5 55.5 101.5 51.5 107 48.5C109 55 109.3 62 107.5 68Z" />
        <path className="ear-in" d="M77.5 62.5C77.5 58.5 78.3 55 79.4 52.8C82.6 55 85.3 57.5 87.4 60Z" />
        <path className="ear-in" d="M95.5 59.4C98.5 57 101.3 54.8 104.2 53.2C105.2 56.8 105.3 60.8 104.6 64.6Z" />
        <path className="fur" d="M70 78C70 66 80 60 91 60C103 60 112 67 112 78C112 89 103 95 91 95C80 95 70 89 70 78Z" />
        <ellipse className="cream" cx="91" cy="85.5" rx="9.5" ry="6.2" />
        <path className="stripe thin" d="M86 61.2v5M91 60.6v6M96 61.2v5" />
        <path className="eye-closed" d="M77.5 76.5q5 4.5 10 0M94.5 76.5q5 4.5 10 0M77.5 76.5l-2.4-1.6M104.5 76.5l2.4-1.6" />
        <ellipse className="cheek" cx="79" cy="84" rx="4.2" ry="2.3" />
        <ellipse className="cheek" cx="103" cy="84" rx="4.2" ry="2.3" />
        <path className="nose" d="M89 82.4h4l-2 2.4z" />
        <path className="mouth-line" d="M88 86.4q1.5 1.8 3 0q1.5 1.8 3 0" />
        <path className="collar" d="M75 90.5C84 97.5 98 97.5 107 90.5" />
        <circle className="bell" cx="91" cy="96.6" r="2.8" />
        <ellipse className="paw" cx="80" cy="99" rx="7" ry="4" />
        <ellipse className="paw" cx="101" cy="99" rx="7" ry="4" />
        {(level === 'warn' || level === 'limit') && <Sweat x={114} y={56} />}
      </g>
    </svg>
  )
}
