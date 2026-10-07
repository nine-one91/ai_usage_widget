import { watch, type FSWatcher } from 'node:fs'
import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AccountConfig } from '../../shared/types'
import { findLatestCodexRecord } from '../parsers/codex'
import { snapshot, type UsageFetcher } from './types'

const TAIL_BYTES = 512 * 1024
/** 최근 며칠치 날짜 폴더만 본다 */
const RECENT_DAY_DIRS = 7
const MAX_FILES_TO_SCAN = 8

export function defaultCodexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), '.codex')
}

async function sortedDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse()
  } catch {
    return []
  }
}

/** sessions/YYYY/MM/DD 구조에서 최근 날짜 폴더들 */
async function recentDayDirs(sessionsDir: string): Promise<string[]> {
  const result: string[] = []
  for (const y of await sortedDirs(sessionsDir)) {
    for (const m of await sortedDirs(join(sessionsDir, y))) {
      for (const d of await sortedDirs(join(sessionsDir, y, m))) {
        result.push(join(sessionsDir, y, m, d))
        if (result.length >= RECENT_DAY_DIRS) return result
      }
    }
  }
  return result
}

/** 최근에 수정된 rollout 파일 순 (오래 열어둔 세션이 최신 기록을 가질 수 있어서 mtime 기준) */
async function recentRolloutFiles(sessionsDir: string): Promise<string[]> {
  const files: Array<{ path: string; mtime: number }> = []
  for (const dir of await recentDayDirs(sessionsDir)) {
    for (const name of await readdir(dir).catch(() => [] as string[])) {
      if (!name.endsWith('.jsonl')) continue
      const path = join(dir, name)
      const s = await stat(path).catch(() => null)
      if (s) files.push({ path, mtime: s.mtimeMs })
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime).slice(0, MAX_FILES_TO_SCAN).map((f) => f.path)
}

async function readTail(path: string): Promise<string> {
  const fh = await open(path, 'r')
  try {
    const { size } = await fh.stat()
    const start = Math.max(0, size - TAIL_BYTES)
    const buf = Buffer.alloc(size - start)
    await fh.read(buf, 0, buf.length, start)
    return buf.toString('utf8')
  } finally {
    await fh.close()
  }
}

export const fetchCodexLocalUsage: UsageFetcher = async (account) => {
  const sessionsDir = join(account.configDir ?? defaultCodexHome(), 'sessions')
  try {
    const now = Date.now()
    for (const file of await recentRolloutFiles(sessionsDir)) {
      const record = findLatestCodexRecord(await readTail(file), now)
      if (record) {
        return snapshot(account, { plan: record.plan, windows: record.windows, updatedAt: record.timestamp })
      }
    }
    return snapshot(account, { status: 'error', message: '최근 7일 안에 Codex 사용 기록이 없어요' })
  } catch (e) {
    return snapshot(account, { status: 'error', message: (e as Error).message })
  }
}

/** 기록 파일이 바뀌면 onChange를 부른다 (macOS / Windows는 recursive watch 지원) */
export function watchCodexSessions(account: AccountConfig, onChange: () => void): FSWatcher | null {
  const sessionsDir = join(account.configDir ?? defaultCodexHome(), 'sessions')
  let timer: NodeJS.Timeout | undefined
  try {
    return watch(sessionsDir, { recursive: true }, (_event, filename) => {
      if (filename && !String(filename).endsWith('.jsonl')) return
      clearTimeout(timer)
      timer = setTimeout(onChange, 2_000)
    })
  } catch {
    return null
  }
}
