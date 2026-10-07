import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { SETTINGS_METHODS, type AppInfo, type SettingsApi, type WidgetApi, type WidgetState } from '../shared/types'

const widget: WidgetApi = {
  onState(cb) {
    const listener = (_e: IpcRendererEvent, state: WidgetState) => cb(state)
    ipcRenderer.on('widget:state', listener)
    ipcRenderer.send('widget:ready')
    return () => ipcRenderer.off('widget:state', listener)
  },
  setInteractive: (interactive) => ipcRenderer.send('widget:interactive', interactive),
  refresh: () => ipcRenderer.send('widget:refresh'),
  dragStart: () => ipcRenderer.send('widget:drag-start'),
  dragMove: () => ipcRenderer.send('widget:drag-move'),
  dragEnd: () => ipcRenderer.send('widget:drag-end'),
  openMenu: () => ipcRenderer.send('widget:open-menu')
}

const invokers = Object.fromEntries(
  SETTINGS_METHODS.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(`settings:${name}`, ...args)])
) as Omit<SettingsApi, 'onChange'>

const settingsApi: SettingsApi = {
  ...invokers,
  onChange(cb) {
    const listener = (_e: IpcRendererEvent, info: AppInfo) => cb(info)
    ipcRenderer.on('settings:changed', listener)
    return () => void ipcRenderer.off('settings:changed', listener)
  }
}

contextBridge.exposeInMainWorld('widget', widget)
contextBridge.exposeInMainWorld('settingsApi', settingsApi)
