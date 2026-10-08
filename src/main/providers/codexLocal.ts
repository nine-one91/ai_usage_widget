import { execFile } from 'node:child_process'
import { watch, type FSWatcher } from 'node:fs'
import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { AccountConfig } from '../../shared/types'
import { CODEX_ACTIVITY_STALE_MS, codexTaskRunning } from '../parsers/activity'
import { findLatestCodexRecord } from '../parsers/codex'
import { snapshot, type BusyChecker, type UsageFetcher } from './types'

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
async function recentRolloutFiles(sessionsDir: string): Promise<Array<{ path: string; mtime: number }>> {
  const files: Array<{ path: string; mtime: number }> = []
  for (const dir of await recentDayDirs(sessionsDir)) {
    for (const name of await readdir(dir).catch(() => [] as string[])) {
      if (!name.endsWith('.jsonl')) continue
      const path = join(dir, name)
      const s = await stat(path).catch(() => null)
      if (s) files.push({ path, mtime: s.mtimeMs })
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime).slice(0, MAX_FILES_TO_SCAN)
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
      const record = findLatestCodexRecord(await readTail(file.path), now)
      if (record) {
        return snapshot(account, { plan: record.plan, windows: record.windows, updatedAt: record.timestamp })
      }
    }
    return snapshot(account, { status: 'error', message: '최근 7일 안에 Codex 사용 기록이 없어요' })
  } catch (e) {
    return snapshot(account, { status: 'error', message: (e as Error).message })
  }
}

/**
 * 최근 기록 중 하나라도 마지막 턴 표시가 task_started면 작업 중.
 * 작업 도중 강제 종료되면 기록이 task_started로 남으므로 codex 프로세스가 떠 있는지도 본다.
 * 명령 하나가 오래 걸리면 기록이 한참 안 바뀔 수 있어서 수정 시각으로는 거의 거르지 않는다.
 */
export const fetchCodexBusy: BusyChecker = async (account) => {
  const sessionsDir = join(account.configDir ?? defaultCodexHome(), 'sessions')
  const now = Date.now()
  try {
    for (const file of await recentRolloutFiles(sessionsDir)) {
      if (now - file.mtime > CODEX_ACTIVITY_STALE_MS) break // mtime 내림차순
      // 표시가 없으면(끝부분이 한 턴의 출력으로 가득 참) 진행 중으로 본다
      if ((codexTaskRunning(await readTail(file.path)) ?? true) && (await codexProcessRunning())) return true
    }
  } catch {
    // 읽지 못하면 쉬는 것으로 둔다
  }
  return false
}

/** codex 실행 파일(CLI, 앱 안의 CLI)이 떠 있는지. 확인할 수 없는 환경이면 true */
function codexProcessRunning(): Promise<boolean> {
  if (process.platform === 'win32') return Promise.resolve(true)
  return new Promise((resolve) => {
    execFile('ps', ['-axo', 'comm='], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(true)
      resolve(stdout.split('\n').some((line) => /^codex(-[\w-]+)?$/.test(basename(line.trim()))))
    })
  })
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
