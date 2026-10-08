export type ProviderId = 'claude' | 'codex'

/**
 * 사용량을 어디서 읽는지. 둘 다 로컬 파일만 읽는다 (토큰·네트워크 없음).
 * - mod:   usage-export mod가 남긴 파일 (~/.ai-usage-widget/claude)
 * - local: Codex 세션 기록 파일
 */
export type AccountSource = 'mod' | 'local'

export interface AccountConfig {
  id: string
  provider: ProviderId
  source: AccountSource
  label: string
  /** mod: Claude 설정 폴더 (~/.claude, ~/.claude-personal …) / local: CODEX_HOME */
  configDir?: string
}

export interface UsageWindow {
  /** five_hour, seven_day, primary … */
  key: string
  label: string
  /** 0–100 */
  percent: number
  /** epoch ms */
  resetsAt: number | null
  /** 기록된 리셋 시각이 이미 지나서 0%로 간주한 경우 */
  resetPassed?: boolean
}

export type SnapshotStatus = 'loading' | 'ok' | 'error'

export interface UsageSnapshot {
  accountId: string
  provider: ProviderId
  source: AccountSource
  label: string
  plan?: string
  windows: UsageWindow[]
  status: SnapshotStatus
  message?: string
  /** 데이터 자체의 기준 시각 (local은 기록 시각, API는 조회 시각) */
  updatedAt: number | null
  /** 이 계정으로 지금 작업 중(턴 진행 중)인 세션이 있다 */
  busy?: boolean
}

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface Point {
  x: number
  y: number
}

export type Level = 'unknown' | 'calm' | 'normal' | 'warn' | 'limit'

export interface Settings {
  /** 설정 파일 형식 버전 (마이그레이션용) */
  version: number
  /** 기본 위치. position이 없을 때 이 구석에 붙는다 */
  corner: Corner
  /** 드래그로 옮긴 위치 (캐릭터 중심의 화면 좌표). null이면 corner 기본 위치 */
  position: Point | null
  alwaysExpanded: boolean
  /** 'default' = 내장 캐릭터, 그 외 = userData/characters/<이름> 폴더 */
  characterPack: string
  /** 캐릭터 한 변 크기 (px). CHARACTER_SIZES 중 하나 */
  characterSize: number
  accounts: AccountConfig[]
}

export interface WidgetState {
  snapshots: UsageSnapshot[]
  level: Level
  /** 계정 중 하나라도 작업 중이면 true — 캐릭터가 뛴다 */
  busy: boolean
  corner: Corner
  alwaysExpanded: boolean
  characterPack: string
  characterSize: number
}

/** 설정에서 고를 수 있는 캐릭터 크기 (px) */
export const CHARACTER_SIZES: Array<[number, string]> = [
  [56, '작게'],
  [80, '보통'],
  [112, '크게'],
  [144, '아주 크게']
]
export const DEFAULT_CHARACTER_SIZE = 80

/** 목록에 없는 값(손으로 고친 설정 등)은 가장 가까운 크기로 */
export function normalizeCharacterSize(size: unknown): number {
  if (typeof size !== 'number' || !Number.isFinite(size)) return DEFAULT_CHARACTER_SIZE
  return CHARACTER_SIZES.map(([s]) => s).reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a))
}

export interface WidgetApi {
  onState(cb: (state: WidgetState) => void): () => void
  setInteractive(interactive: boolean): void
  refresh(): void
  dragStart(): void
  dragMove(): void
  dragEnd(): void
  openMenu(): void
}

export interface AppInfo {
  settings: Settings
  snapshots: UsageSnapshot[]
  openAtLogin: boolean
  /** 개발 모드에서는 자동 실행에 Electron 자체가 등록된다 */
  isPackaged: boolean
  characterPacks: string[]
}

export interface SettingsApi {
  get(): Promise<AppInfo>
  onChange(cb: (info: AppInfo) => void): () => void
  update(patch: Partial<Settings>): Promise<void>
  setOpenAtLogin(enabled: boolean): Promise<void>
  resetPosition(): Promise<void>
  addFolder(kind: 'claude' | 'codex'): Promise<void>
  renameAccount(accountId: string, label: string): Promise<void>
  /** 계정 id를 위젯에 보일 순서대로 */
  reorderAccounts(accountIds: string[]): Promise<void>
  removeAccount(accountId: string): Promise<void>
  openCharactersFolder(): Promise<void>
}

/** settings:<이름> IPC 채널로 호출되는 SettingsApi 메서드 */
export const SETTINGS_METHODS = [
  'get',
  'update',
  'setOpenAtLogin',
  'resetPosition',
  'addFolder',
  'renameAccount',
  'reorderAccounts',
  'removeAccount',
  'openCharactersFolder'
] as const satisfies ReadonlyArray<Exclude<keyof SettingsApi, 'onChange'>>
