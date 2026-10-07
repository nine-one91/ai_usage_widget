import type { SettingsApi, WidgetApi } from '../../shared/types'

declare global {
  interface Window {
    widget: WidgetApi
    settingsApi: SettingsApi
  }
}
