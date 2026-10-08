import type { EngineInterface, Register, SessionRateLimit, Timer } from 'claude-code'
import { activityFileName, exportFileName } from './fileName'

// 1) 응답마다 엔진이 측정한 한도(rateLimits)를 ~/.ai-usage-widget/claude/<설정 폴더 이름>.json 에 남긴다.
// 2) 턴이 진행 중인지를 ~/.ai-usage-widget/activity/claude-<세션 id>.json 에 남긴다 (위젯 고양이가 뛰고/잔다).
// 위젯은 이 파일들만 읽는다: 토큰도 네트워크 요청도 쓰지 않는다.

export interface UsageExport {
  version: 1
  /** 이 세션의 Claude Code 설정 폴더 (계정 구분용) */
  configDir: string
  /** epoch ms */
  updatedAt: number
  rateLimits: SessionRateLimit[]
}

export interface ActivityExport {
  version: 1
  configDir: string
  sessionId: string
  /** 턴이 진행 중이면 true */
  busy: boolean
  /** epoch ms — 작업 중에는 HEARTBEAT_MS마다 다시 쓴다. 위젯은 갱신이 끊긴 busy를 무시한다 (강제 종료 대비) */
  updatedAt: number
}

/** 작업 중 다시 쓰는 간격. 도구 하나가 오래 걸려도 타이머가 계속 쓴다 */
export const HEARTBEAT_MS = 30_000

async function locate($: EngineInterface): Promise<{ home: string; configDir: string } | null> {
  const home = await $.env.get('HOME')
  if (!home) return null
  // Desktop Code 탭처럼 CLAUDE_CONFIG_DIR 없이 뜬 세션은 기본 폴더(~/.claude)
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${home}/.claude`
  return { home, configDir }
}

/** sessionId를 주지 않으면 지금 세션 */
async function writeActivity($: EngineInterface, busy: boolean, sessionId?: string): Promise<void> {
  try {
    const where = await locate($)
    if (!where) return
    const id = sessionId ?? (await $.session.id())
    const data: ActivityExport = {
      version: 1,
      configDir: where.configDir,
      sessionId: id,
      busy,
      updatedAt: await $.clock.now(),
    }
    await $.fs.write(`${where.home}/.ai-usage-widget/activity/${activityFileName(id)}`, JSON.stringify(data, null, 2))
  } catch {
    // 기록 실패가 세션을 방해하지 않게 한다
  }
}

export const register: Register = on => {
  let heartbeat: Timer | undefined

  const stopHeartbeat = () => {
    heartbeat?.cancel()
    heartbeat = undefined
  }

  on('turn.start', async ($, e, next) => {
    await writeActivity($, true)
    stopHeartbeat()
    heartbeat = $.clock.every(HEARTBEAT_MS, () => void writeActivity($, true))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // 서브에이전트의 턴이 끝난 건 본 턴의 끝이 아니다
    if (!e.agentId) {
      stopHeartbeat()
      await writeActivity($, false)
    }
    return result
  })

  // 종료·/clear: 끝나는 세션의 id로 쉬는 상태를 남긴다
  on('session.end', async ($, e, next) => {
    stopHeartbeat()
    await writeActivity($, false, e.sessionId)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (!e.changed.includes('rateLimits')) return result
    try {
      const where = await locate($)
      if (!where) return result
      const data: UsageExport = {
        version: 1,
        configDir: where.configDir,
        updatedAt: await $.clock.now(),
        rateLimits: e.rateLimits,
      }
      await $.fs.write(`${where.home}/.ai-usage-widget/claude/${exportFileName(where.configDir)}`, JSON.stringify(data, null, 2))
    } catch {
      // 기록 실패가 세션을 방해하지 않게 한다
    }
    return result
  })
}
