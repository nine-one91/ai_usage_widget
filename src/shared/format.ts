const MINUTE = 60_000

function minutesText(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 ${min % 60}분`
  return `${Math.floor(h / 24)}일 ${h % 24}시간`
}

/** 리셋까지 남은 시간. Claude Desktop처럼 올림: 3시간 27분 10초 → "3시간 28분" */
export function formatRemaining(ms: number): string {
  return minutesText(Math.max(0, Math.ceil(ms / MINUTE)))
}

/** 기록된 지 지난 시간. 다 채운 분만 센다: 1분 50초 → "1분 전" */
export function formatAgo(ms: number): string {
  const min = Math.floor(ms / MINUTE)
  return min < 1 ? '방금' : `${minutesText(min)} 전`
}
