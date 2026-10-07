import { BrowserWindow, app } from 'electron'
import { join } from 'node:path'

let win: BrowserWindow | null = null

export function settingsWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

/** 설정 창은 하나만 띄운다. 이미 있으면 앞으로 가져온다. */
export function openSettingsWindow(): void {
  const existing = settingsWindow()
  if (existing) {
    existing.show()
    existing.focus()
    app.focus({ steal: true })
    return
  }

  win = new BrowserWindow({
    width: 560,
    height: 640,
    minWidth: 480,
    minHeight: 480,
    title: 'AI 사용량 설정',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#settings`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'settings' })

  win.once('ready-to-show', () => {
    win?.show()
    // Dock 아이콘이 없는 앱이라 직접 앞으로 가져와야 키보드 입력이 된다
    app.focus({ steal: true })
  })
  win.on('closed', () => (win = null))
}
