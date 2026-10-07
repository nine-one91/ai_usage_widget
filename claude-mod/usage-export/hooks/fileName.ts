// mod와 위젯이 함께 쓰는 파일 이름 규칙: 설정 폴더 이름에서 앞의 점을 뺀다
// (~/.claude → claude.json, ~/.claude-personal → claude-personal.json)
export function exportFileName(configDir: string): string {
  const base = configDir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? 'claude'
  return `${base.replace(/^\./, '') || 'claude'}.json`
}
