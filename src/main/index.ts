import { BrowserWindow, app, dialog, ipcMain, screen, shell, type Tray } from 'electron'
import { join } from 'node:path'
import { overallLevel } from '../shared/level'
import {
  SETTINGS_METHODS,
  type AccountConfig,
  type AppInfo,
  type Corner,
  type Point,
  type Settings,
  type SettingsApi,
  type UsageSnapshot,
  type WidgetState
} from '../shared/types'
import { charactersDir, handleCharacterProtocol, listCharacterPacks, registerCharacterScheme } from './characters'
import { defaultClaudeLabel } from './providers/claudeMod'
import { loadSettings, newAccountId, removeLegacyLoginSessions, saveSettings } from './settings'
import { openSettingsWindow, settingsWindow } from './settingsWindow'
import { buildMenu, createTray, type MenuActions } from './tray'
import { UsageService } from './usageService'
import { createWidgetWindow, placeWidget, setWidgetInteractive } from './widgetWindow'

// 설정 폴더를 앱 이름과 상관없이 고정한다. 패키징된 앱(productName "AI Usage Widget")과
// 개발 모드(npm run dev)가 같은 설정(~/Library/Application Support/ai-usage-widget)을 쓴다.
// 테스트용으로 --user-data-dir 를 주면 그 폴더를 쓴다.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'ai-usage-widget'))
}

if (!app.requestSingleInstanceLock()) app.quit()
registerCharacterScheme()

let settings: Settings
let widget: BrowserWindow
let tray: Tray
let snapshots: UsageSnapshot[] = []
/** 지금 캐릭터가 놓인 위치와 카드가 펼쳐지는 방향 */
let placed: { point: Point; corner: Corner }
/** 드래그 중이면 캐릭터 중심 - 커서 */
let drag: Point | null = null

const usage = new UsageService((next) => {
  snapshots = next
  pushState()
  pushSettingsInfo()
})

function pushState(): void {
  if (!widget || widget.isDestroyed()) return
  const state: WidgetState = {
    snapshots,
    level: overallLevel(snapshots),
    corner: placed.corner,
    alwaysExpanded: settings.alwaysExpanded,
    characterPack: settings.characterPack
  }
  widget.webContents.send('widget:state', state)
}

function appInfo(): AppInfo {
  return {
    settings,
    snapshots,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    isPackaged: app.isPackaged,
    characterPacks: listCharacterPacks()
  }
}

function pushSettingsInfo(): void {
  settingsWindow()?.webContents.send('settings:changed', appInfo())
}

function place(): void {
  placed = placeWidget(widget, settings.position, settings.corner)
}

function applySettings(patch: Partial<Settings>): void {
  const accountsChanged = 'accounts' in patch
  settings = { ...settings, ...patch }
  saveSettings(settings)
  place()
  tray.setContextMenu(buildMenu(settings, menuActions))
  if (accountsChanged) usage.configure(settings.accounts)
  pushState()
  pushSettingsInfo()
}

function updateAccount(id: string, patch: Partial<AccountConfig>): void {
  applySettings({ accounts: settings.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
}

const menuActions: MenuActions = {
  refresh: () => void usage.refreshAll(),
  setAlwaysExpanded: (alwaysExpanded) => applySettings({ alwaysExpanded }),
  resetPosition: () => applySettings({ position: null }),
  openSettings: openSettingsWindow
}

const settingsHandlers: Omit<SettingsApi, 'onChange'> = {
  get: async () => appInfo(),
  update: async (patch) => applySettings(patch),
  setOpenAtLogin: async (openAtLogin) => {
    app.setLoginItemSettings({ openAtLogin })
    pushSettingsInfo()
  },
  resetPosition: async () => applySettings({ position: null }),
  addFolder: async (kind) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: kind === 'claude' ? 'Claude Code 설정 폴더 (예: ~/.claude-work)' : 'Codex 폴더 (CODEX_HOME)',
      defaultPath: app.getPath('home'),
      properties: ['openDirectory', 'showHiddenFiles']
    })
    if (canceled || !filePaths[0]) return
    const dir = filePaths[0]
    const account: AccountConfig =
      kind === 'claude'
        ? { id: newAccountId(), provider: 'claude', source: 'mod', label: defaultClaudeLabel(dir), configDir: dir }
        : { id: newAccountId(), provider: 'codex', source: 'local', label: 'Codex', configDir: dir }
    applySettings({ accounts: [...settings.accounts, account] })
  },
  renameAccount: async (id, label) => {
    if (label.trim()) updateAccount(id, { label: label.trim() })
  },
  reorderAccounts: async (ids) => {
    const byId = new Map(settings.accounts.map((a) => [a.id, a]))
    // 그 사이 계정이 추가/삭제됐으면 무시한다 (설정 창이 새 목록으로 다시 그려진다)
    if (ids.length !== byId.size || !ids.every((id) => byId.has(id))) return
    applySettings({ accounts: ids.map((id) => byId.get(id)!) })
  },
  removeAccount: async (id) => {
    applySettings({ accounts: settings.accounts.filter((a) => a.id !== id) })
  },
  openCharactersFolder: async () => {
    listCharacterPacks() // 폴더가 없으면 만든다
    await shell.openPath(charactersDir())
  }
}

function registerIpc(): void {
  ipcMain.on('widget:interactive', (_e, interactive: boolean) => setWidgetInteractive(widget, interactive))
  ipcMain.on('widget:refresh', () => void usage.refreshAll())
  ipcMain.on('widget:ready', pushState)
  ipcMain.on('widget:open-menu', () => buildMenu(settings, menuActions).popup({ window: widget }))

  // 드래그: 렌더러는 신호만 보내고, 좌표는 main이 실제 커서 위치로 계산한다
  ipcMain.on('widget:drag-start', () => {
    const cursor = screen.getCursorScreenPoint()
    drag = { x: placed.point.x - cursor.x, y: placed.point.y - cursor.y }
  })
  ipcMain.on('widget:drag-move', () => {
    if (!drag) return
    const cursor = screen.getCursorScreenPoint()
    const prevCorner = placed.corner
    placed = placeWidget(widget, { x: cursor.x + drag.x, y: cursor.y + drag.y }, settings.corner)
    if (placed.corner !== prevCorner) pushState()
  })
  ipcMain.on('widget:drag-end', () => {
    if (!drag) return
    drag = null
    applySettings({ position: placed.point })
  })

  for (const name of SETTINGS_METHODS) {
    const handler = settingsHandlers[name] as (...args: unknown[]) => Promise<unknown>
    ipcMain.handle(`settings:${name}`, (_e, ...args) => handler(...args))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide()
  handleCharacterProtocol()

  settings = loadSettings()
  removeLegacyLoginSessions()
  widget = createWidgetWindow()
  place()
  tray = createTray()
  tray.setContextMenu(buildMenu(settings, menuActions))
  registerIpc()

  screen.on('display-metrics-changed', place)
  screen.on('display-removed', place)
  usage.configure(settings.accounts)
})

app.on('second-instance', openSettingsWindow)
// 위젯 앱이라 설정/로그인 창을 닫아도 종료하지 않는다
app.on('window-all-closed', () => {})
app.on('before-quit', () => usage.stop())
