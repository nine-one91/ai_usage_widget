import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { Corner, Point } from '../shared/types'
import { WIDGET_HEIGHT, WIDGET_WIDTH, defaultPoint, widgetLayout } from './position'

// 창은 펼친 카드 크기로 고정하고, 투명한 부분은 클릭이 아래 앱으로 통과하게 한다.
// 렌더러가 캐릭터/카드 위에 마우스가 올라왔을 때만 setInteractive(true)를 보낸다.
export function createWidgetWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    // macOS: 포커스를 뺏지 않는 NSPanel
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  win.once('ready-to-show', () => win.showInactive())
  return win
}

/**
 * 캐릭터 중심이 point에 오도록 창을 옮긴다. point가 없으면 주 모니터의 corner 기본 위치.
 * 화면 밖이면 가장 가까운 모니터 안으로 당긴다 (모니터를 뺀 뒤 다시 실행한 경우 등).
 * 실제로 놓인 위치와, 카드가 펼쳐질 방향(구석)을 돌려준다.
 */
export function placeWidget(win: BrowserWindow, point: Point | null, corner: Corner): { point: Point; corner: Corner } {
  const target = point ?? defaultPoint(corner, screen.getPrimaryDisplay().workArea)
  const layout = widgetLayout(target, screen.getDisplayNearestPoint(target).workArea)
  win.setBounds(layout.bounds)
  return { point: layout.point, corner: layout.corner }
}

export function setWidgetInteractive(win: BrowserWindow, interactive: boolean): void {
  if (interactive) win.setIgnoreMouseEvents(false)
  else win.setIgnoreMouseEvents(true, { forward: true })
}
