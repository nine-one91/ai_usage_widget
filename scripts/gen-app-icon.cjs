// 앱 아이콘 생성: 기본 캐릭터(여유 상태)를 macOS 아이콘 모양 배경 위에 그려 build/icon.png, build/icon.icns 로 저장한다.
// 실행: npx electron scripts/gen-app-icon.cjs
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('node:child_process')
const { mkdirSync, rmSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const OUT = join(__dirname, '..', 'build')
const SIZE = 1024

// src/renderer/src/components/Character.tsx 의 DefaultCharacter (calm) 와 같은 모양
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#34404d"/><stop offset="1" stop-color="#1c232b"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
  <g transform="translate(232 228) scale(10)">
    <path d="M28 4c14 0 24 10 24 25 0 13-10 23-24 23S4 42 4 29C4 14 14 4 28 4z" fill="#7ee2b8"/>
    <ellipse cx="15" cy="34" rx="4" ry="2.5" fill="#ff8fa3" opacity="0.55"/>
    <ellipse cx="41" cy="34" rx="4" ry="2.5" fill="#ff8fa3" opacity="0.55"/>
    <ellipse cx="20" cy="27" rx="3" ry="3.5" fill="#2b2b2e"/>
    <ellipse cx="36" cy="27" rx="3" ry="3.5" fill="#2b2b2e"/>
    <path d="M20 39 q8 7 16 0" fill="none" stroke="#2b2b2e" stroke-width="2.4" stroke-linecap="round"/>
  </g>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })
  await win.loadURL(
    'data:text/html,' +
      encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  )
  await new Promise((r) => setTimeout(r, 300))
  const png = (await win.webContents.capturePage()).resize({ width: SIZE, height: SIZE }).toPNG()
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'icon.png'), png)

  // .icns: iconutil 이 요구하는 크기별 PNG 묶음(iconset)에서 만든다
  const iconset = join(OUT, 'icon.iconset')
  rmSync(iconset, { recursive: true, force: true })
  mkdirSync(iconset)
  for (const s of [16, 32, 128, 256, 512]) {
    for (const [scale, suffix] of [[1, ''], [2, '@2x']]) {
      const px = String(s * scale)
      execFileSync('sips', ['-z', px, px, join(OUT, 'icon.png'), '--out', join(iconset, `icon_${s}x${s}${suffix}.png`)], { stdio: 'ignore' })
    }
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(OUT, 'icon.icns')])
  rmSync(iconset, { recursive: true, force: true })
  console.log('wrote build/icon.png, build/icon.icns')
  app.exit(0)
})
