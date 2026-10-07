# AI 사용량 위젯

화면 구석에 떠 있는 캐릭터에 마우스를 올리면 Claude / Codex 사용 한도가 펼쳐지는 데스크톱 위젯. (1차: macOS, Windows는 구조만 대비)

## 실행

```bash
nvm use          # Node 24 (Electron 44 설치에 Node 22.12+ 필요)
npm install
npm run dev      # 개발 모드 (렌더러 핫 리로드)
npm test         # 파서 단위 테스트
npm run build    # out/ 에 빌드
npm run dist     # 패키징: dist/AI Usage Widget-<버전>-arm64.dmg / -mac.zip
npm run icon     # 앱 아이콘(build/icon.png, icon.icns) 다시 만들기
```

### 패키징

- `electron-builder`로 Apple Silicon(arm64)용 dmg·zip을 만든다. Dock 아이콘 없이 메뉴 막대 앱으로 실행된다 (`LSUIElement`).
- 개발자 인증서 없이 **임시 서명(ad-hoc)** 만 한다. 이 Mac에서 만든 앱은 그대로 열리지만, 다른 Mac으로 내려받아 옮기면 Gatekeeper가 막는다 → Finder에서 우클릭 → 열기, 또는 `xattr -dr com.apple.quarantine "/Applications/AI Usage Widget.app"`.
- 설정은 개발 모드와 같은 `~/Library/Application Support/ai-usage-widget`를 쓴다. 한 번에 하나만 실행되므로 `npm run dev`를 끄고 앱을 실행한다.
- 앱 안에 mod 사본이 들어 있다: `/Applications/AI Usage Widget.app/Contents/Resources/claude-mod/usage-export`

- 캐릭터를 끌어서 옮기면 그 위치를 기억한다 (다음 실행에도 유지). 화면의 어느 쪽에 두느냐에 따라 카드가 화면 안쪽으로 펼쳐진다.
- 캐릭터 우클릭 또는 메뉴 막대 아이콘: 새로고침, 항상 펼쳐두기, 위치 초기화, 설정
- 설정 창: 로그인 시 자동 실행, 기본 위치 / 위치 초기화, 캐릭터, 계정 추가·이름 변경·순서 변경·삭제

첫 실행 때 `~/.claude`, `~/.claude-*`, `~/.codex`를 찾아 계정을 자동 등록한다.
설정 파일: `~/Library/Application Support/ai-usage-widget/settings.json`

## 계정 종류

| 서비스 | source | 읽는 곳 |
|---|---|---|
| Claude | `mod` | `~/.ai-usage-widget/claude/<설정 폴더>.json` — `claude-mod/usage-export`가 응답마다 기록 |
| Codex | `local` | `CODEX_HOME/sessions/**/rollout-*.jsonl` 의 `rate_limits` |

- 위젯은 로컬 파일만 읽는다. 토큰·쿠키를 쓰지 않고 네트워크 요청도 하지 않는다.
  (구독 OAuth 토큰이나 claude.ai 세션으로 비공식 사용량 API를 부르는 방식은 Anthropic 소비자 약관(2026-02) 위반 소지가 있어 쓰지 않는다.)
- 기록 파일이 바뀌면 파일 감시로 바로 반영하고, 1분마다 다시 읽는다 (리셋 시각이 지나면 0%). 해당 도구를 쓸 때만 갱신되므로 "N분 전 기준"을 함께 표시한다.

### usage-export mod 등록

Claude Code의 mod(함수 hook 플러그인)가 `session.measure` 이벤트의 `rateLimits`를 파일로 남긴다. 터미널 Claude Code와 Claude Desktop의 Code 탭 모두에서 동작한다.
각 Claude 설정 폴더의 `settings.json`에 추가한 뒤 Claude Code / Desktop을 새로 시작한다:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/절대경로/claude-mod/usage-export" } }
```

```bash
claude plugin validate claude-mod/usage-export
claude plugin test claude-mod/usage-export
```

## 캐릭터

사용률(모든 계정 중 최댓값)에 따라 상태가 바뀐다: `unknown` · `calm`(<50%) · `normal`(<80%) · `warn`(<100%) · `limit`.
기본 캐릭터는 SVG + CSS 애니메이션. 직접 만든 팩은 `~/Library/Application Support/ai-usage-widget/characters/<팩 이름>/<상태>.(gif|webp|apng|png|svg)` 에 넣고 메뉴 → 캐릭터에서 고른다. 없는 상태는 기본 캐릭터로 대신 그린다.

## 구조

```
src/main/
  index.ts          앱 수명주기, IPC, 계정 추가/삭제
  widgetWindow.ts   최상위 투명 창 (macOS NSPanel, 투명 영역 클릭 통과)
  position.ts       위치 계산 (캐릭터 중심 좌표 → 창 위치, 펼칠 방향)
  settingsWindow.ts 설정 창
  tray.ts           메뉴 막대 / 우클릭 메뉴
  usageService.ts   주기 조회 + Codex 기록 파일 감시
  providers/        claudeMod / codexLocal
  parsers/          응답·기록 파싱 (Electron 의존 없음, 테스트 대상)
  characters.ts     character:// 프로토콜 (사용자 캐릭터 팩)
src/preload/        렌더러에 window.widget API 노출
src/renderer/       위젯(캐릭터 + 사용량 카드)과 설정 화면(#settings) (React)
src/shared/         공통 타입, 사용률 → 상태 계산
claude-mod/usage-export/  Claude Code mod (한도 → 파일). fileName.ts는 위젯과 공유
```

## 아직 안 된 것

- Claude Desktop 채팅만 쓰는 경우: `~/Library/Application Support/Claude/plan-usage-history.json` 읽기 (리셋 시각 없음)
- 설정 창에서 mod 등록 상태 표시 / 등록 버튼
- Windows: 경로·트레이 아이콘 실기기 검증
- 로그인 시 자동 실행: 패키징된 앱에서 실기기 검증 필요
- Developer ID 서명·공증 (다른 사람에게 배포할 때)
