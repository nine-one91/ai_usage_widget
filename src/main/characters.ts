import { app, net, protocol } from 'electron'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LEVELS } from '../shared/level'

// 사용자 캐릭터 팩: userData/characters/<팩 이름>/<상태>.<확장자>
// 상태: busy(작업 중), idle(쉬는 중) — 없으면 사용량 단계 unknown, calm, normal, warn, limit
// 그것도 없으면 렌더러가 내장 캐릭터로 대신 그린다.
// 렌더러는 <img src="character://<팩>/<상태>"> 로 불러온다.
const SCHEME = 'character'
const EXTENSIONS = ['gif', 'webp', 'apng', 'png', 'svg']
const STATES: string[] = ['busy', 'idle', ...LEVELS]

export const charactersDir = () => join(app.getPath('userData'), 'characters')

/** app ready 전에 호출해야 한다 */
export function registerCharacterScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }])
}

export function handleCharacterProtocol(): void {
  protocol.handle(SCHEME, (req) => {
    const { hostname: pack, pathname } = new URL(req.url)
    const state = pathname.replace(/^\//, '')
    if (!/^[\w-]+$/.test(pack) || !STATES.includes(state)) return new Response(null, { status: 400 })
    for (const ext of EXTENSIONS) {
      const file = join(charactersDir(), pack, `${state}.${ext}`)
      if (existsSync(file)) return net.fetch(pathToFileURL(file).toString())
    }
    return new Response(null, { status: 404 })
  })
}

export function listCharacterPacks(): string[] {
  mkdirSync(charactersDir(), { recursive: true })
  return readdirSync(charactersDir(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[\w-]+$/.test(e.name))
    .map((e) => e.name)
}
