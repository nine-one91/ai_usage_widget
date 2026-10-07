import type { Register, SessionRateLimit } from 'claude-code'
import { exportFileName } from './fileName'

// 응답마다 엔진이 측정한 한도(rateLimits)를 ~/.ai-usage-widget/claude/<설정 폴더 이름>.json 에 남긴다.
// 위젯은 이 파일만 읽는다: 토큰도 네트워크 요청도 쓰지 않는다.

export interface UsageExport {
  version: 1
  /** 이 세션의 Claude Code 설정 폴더 (계정 구분용) */
  configDir: string
  /** epoch ms */
  updatedAt: number
  rateLimits: SessionRateLimit[]
}

export const register: Register = on => {
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (!e.changed.includes('rateLimits')) return result
    try {
      const home = await $.env.get('HOME')
      if (!home) return result
      // Desktop Code 탭처럼 CLAUDE_CONFIG_DIR 없이 뜬 세션은 기본 폴더(~/.claude)
      const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${home}/.claude`
      const data: UsageExport = {
        version: 1,
        configDir,
        updatedAt: await $.clock.now(),
        rateLimits: e.rateLimits,
      }
      await $.fs.write(`${home}/.ai-usage-widget/claude/${exportFileName(configDir)}`, JSON.stringify(data, null, 2))
    } catch {
      // 기록 실패가 세션을 방해하지 않게 한다
    }
    return result
  })
}
