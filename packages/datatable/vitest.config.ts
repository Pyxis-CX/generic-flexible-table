import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// DT_COMPILER=1 corre la suite contra el código COMPILADO con React Compiler
// (la memoización puede enmascarar bugs de deps: CI ejecuta ambas patas).
const withCompiler = process.env.DT_COMPILER === '1'

export default defineConfig({
  plugins: [
    react(
      withCompiler
        ? { babel: { plugins: [['babel-plugin-react-compiler', { target: '19' }]] } }
        : undefined,
    ),
  ],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          typecheck: {
            enabled: true,
            include: ['test/**/*.test-d.ts'],
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/browser/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'bench',
          include: [],
          benchmark: {
            include: ['bench/**/*.bench.ts'],
          },
        },
      },
    ],
  },
})
