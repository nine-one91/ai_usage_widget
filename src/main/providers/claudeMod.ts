import { mkdirSync, watch, type FSWatcher } from 'node:fs'
import { readFile, readdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import type { AccountConfig } from '../../shared/types'
import { isClaudeActivityLive, parseClaudeActivity } from '../parsers/activity'
import { modExportFileName, parseModExport } from '../parsers/claudeMod'
import { snapshot, type BusyChecker, type UsageFetcher } from './types'

/** 설정 폴더 이름으로 계정 이름을 짓는다: ~/.claude → Claude, ~/.claude-work → Claude · work */
export function defaultClaudeLabel(configDir: string): string {
  const suffix = basename(resolve(configDir)).replace(/^\.claude-?/, '')
  return suffix ? `Claude · ${suffix}` : 'Claude'
}

/** usage-export mod가 쓰는 폴더 */
export const modExportDir = () => join(homedir(), '.ai-usage-widget', 'claude')

/** usage-export mod가 세션마다 작업 상태를 쓰는 폴더 (claude-<세션 id>.json) */
export const activityDir = () => join(homedir(), '.ai-usage-widget', 'activity')
const ACTIVITY_PREFIX = 'claude-'
/** 끝난 세션의 파일은 이만큼 지나면 지운다 */
const ACTIVITY_KEEP_MS = 7 * 24 * 60 * 60_000

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

/** 이 계정(설정 폴더)의 세션 중 하나라도 턴이 진행 중이면 true */
export const fetchClaudeBusy: BusyChecker = async (account) => {
  const fileName = modExportFileName(account.configDir ?? join(homedir(), '.claude'))
  const now = Date.now()
  let busy = false
  const names = await readdir(activityDir()).catch(() => [] as string[])
  for (const name of names) {
    if (!name.startsWith(ACTIVITY_PREFIX) || !name.endsWith('.json')) continue
    const path = join(activityDir(), name)
    const activity = parseClaudeActivity(await readFile(path, 'utf8').catch(() => ''))
    if (!activity) continue
    if (now - activity.updatedAt > ACTIVITY_KEEP_MS) {
      void unlink(path).catch(() => {})
      continue
    }
    // 계정 구분은 사용량 파일과 같은 규칙 (설정 폴더 이름)
    if (modExportFileName(activity.configDir) === fileName && isClaudeActivityLive(activity, now)) busy = true
  }
  return busy
}

/** mod가 사용량·작업 상태 파일을 새로 쓰면 onChange를 부른다 */
export function watchModExports(onChange: () => void): FSWatcher[] {
  let timer: NodeJS.Timeout | undefined
  const watchers: FSWatcher[] = []
  for (const dir of [modExportDir(), activityDir()]) {
    try {
      mkdirSync(dir, { recursive: true })
      watchers.push(
        watch(dir, () => {
          clearTimeout(timer)
          timer = setTimeout(onChange, 300)
        })
      )
    } catch {
      // 감시가 안 되면 주기 조회로 대신한다
    }
  }
  return watchers
}
