import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'
import type { Settings } from '../shared/types'

export interface MenuActions {
  refresh(): void
  setAlwaysExpanded(enabled: boolean): void
  resetPosition(): void
  openSettings(): void
}

export function createTray(): Tray {
  // 패키징된 앱은 extraResources 로 Resources/ 바로 아래에 둔다
  const dir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
  const icon = nativeImage.createFromPath(join(dir, 'trayTemplate.png'))
  icon.setTemplateImage(true)
  const tray = new Tray(icon)
  tray.setToolTip('AI 사용량')
  return tray
}

/** 메뉴 막대 아이콘과 캐릭터 우클릭에서 같이 쓰는 메뉴 */
export function buildMenu(settings: Settings, actions: MenuActions): Menu {
  return Menu.buildFromTemplate([
    { label: '지금 새로고침', click: actions.refresh },
    {
      label: '항상 펼쳐두기',
      type: 'checkbox',
      checked: settings.alwaysExpanded,
      click: (item) => actions.setAlwaysExpanded(item.checked)
    },
    { label: '위치 초기화', enabled: settings.position !== null, click: actions.resetPosition },
    { type: 'separator' },
    { label: '설정…', accelerator: 'CommandOrControl+,', click: actions.openSettings },
    { type: 'separator' },
    { label: '종료', role: 'quit' }
  ])
}
