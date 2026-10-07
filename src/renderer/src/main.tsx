import { createRoot } from 'react-dom/client'
import { App } from './App'
import { SettingsApp } from './settings/SettingsApp'
import './styles.css'

const isSettings = location.hash === '#settings'
createRoot(document.getElementById('root')!).render(isSettings ? <SettingsApp /> : <App />)
