// 작업 중(턴 진행 중)인지 판단한다. Electron 의존 없음 (테스트 대상)

/** Claude mod는 작업 중 30초마다 다시 쓴다. 이만큼 끊기면 강제 종료된 것으로 본다 */
export const CLAUDE_ACTIVITY_STALE_MS = 2 * 60_000
/** Codex 기록이 이만큼 안 바뀌었으면 작업 중이 아니다 (프로세스 확인과 별개인 마지막 안전장치) */
export const CODEX_ACTIVITY_STALE_MS = 24 * 60 * 60_000

export interface ClaudeActivity {
  configDir: string
  busy: boolean
  updatedAt: number
}

/** claude-mod/usage-export 가 쓰는 activity 파일 (version 1). 형식이 다르면 null */
export function parseClaudeActivity(text: string): ClaudeActivity | null {
  try {
    const data = JSON.parse(text)
    if (data?.version !== 1 || typeof data.configDir !== 'string' || typeof data.updatedAt !== 'number') return null
    return { configDir: data.configDir, busy: data.busy === true, updatedAt: data.updatedAt }
  } catch {
    return null // 쓰는 도중에 읽었을 수 있다
  }
}

export function isClaudeActivityLive(a: ClaudeActivity, now: number): boolean {
  return a.busy && now - a.updatedAt < CLAUDE_ACTIVITY_STALE_MS
}

const CODEX_TASK_EVENTS: Record<string, boolean> = {
  task_started: true,
  task_complete: false,
  turn_aborted: false
}

/**
 * Codex 기록 끝부분에서 마지막 턴 표시를 찾는다.
 * true = task_started가 마지막 (진행 중), false = 끝남, null = 표시 없음
 */
export function codexTaskRunning(text: string): boolean | null {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.includes('"event_msg"')) continue
    const type = Object.keys(CODEX_TASK_EVENTS).find((t) => line.includes(`"${t}"`))
    if (!type) continue
    let entry: any
    try {
      entry = JSON.parse(line)
    } catch {
      continue // 기록 중인 마지막 줄은 잘려 있을 수 있다
    }
    if (entry?.type !== 'event_msg') continue
    const running = CODEX_TASK_EVENTS[entry.payload?.type]
    if (running !== undefined) return running
  }
  return null
}
