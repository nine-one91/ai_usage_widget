import { mkdirSync, watch, type FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import type { AccountConfig } from '../../shared/types'
import { modExportFileName, parseModExport } from '../parsers/claudeMod'
import { snapshot, type UsageFetcher } from './types'

/** 설정 폴더 이름으로 계정 이름을 짓는다: ~/.claude → Claude, ~/.claude-work → Claude · work */
export function defaultClaudeLabel(configDir: string): string {
  const suffix = basename(resolve(configDir)).replace(/^\.claude-?/, '')
  return suffix ? `Claude · ${suffix}` : 'Claude'
}

/** usage-export mod가 쓰는 폴더 */
export const modExportDir = () => join(homedir(), '.ai-usage-widget', 'claude')

function exportPath(account: AccountConfig): string {
  return join(modExportDir(), modExportFileName(account.configDir ?? join(homedir(), '.claude')))
}

export const fetchClaudeModUsage: UsageFetcher = async (account) => {
  let text: string
  try {
    text = await readFile(exportPath(account), 'utf8')
  } catch {
    return snapshot(account, {
      status: 'error',
      message: '아직 기록이 없어요 — mod를 등록하고 이 계정으로 Claude Code를 한 번 쓰면 생겨요'
    })
  }
  try {
    const record = parseModExport(text, Date.now())
    if (record.windows.length === 0) {
      return snapshot(account, {
        status: 'error',
        updatedAt: record.updatedAt,
        message: '한도 정보가 없어요 (구독 계정이 아니거나 아직 응답 전)'
      })
    }
    return snapshot(account, { windows: record.windows, updatedAt: record.updatedAt })
  } catch (e) {
    // mod가 파일을 쓰는 도중에 읽었을 수 있다 — 다음 변경 알림이나 주기 조회에서 다시 읽는다
    return snapshot(account, { status: 'error', message: (e as Error).message })
  }
}

/** mod가 파일을 새로 쓰면 onChange를 부른다 */
export function watchModExports(onChange: () => void): FSWatcher | null {
  let timer: NodeJS.Timeout | undefined
  try {
    mkdirSync(modExportDir(), { recursive: true })
    return watch(modExportDir(), () => {
      clearTimeout(timer)
      timer = setTimeout(onChange, 300)
    })
  } catch {
    return null
  }
}
