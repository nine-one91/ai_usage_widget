import { defineConfig } from 'vitest/config'

// claude-mod/ 의 테스트는 `claude plugin test`로 돌린다
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } })
