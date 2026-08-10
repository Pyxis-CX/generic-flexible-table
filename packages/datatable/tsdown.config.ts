import { babel } from '@rollup/plugin-babel'
import { defineConfig } from 'tsdown'

/**
 * React Compiler ANTES del transform de oxc: react.dev recomienda que las
 * bibliotecas precompilen (el compilador de la app no procesa node_modules).
 * Los ficheros con "use no memo" quedan fuera automáticamente.
 */
const reactCompiler = babel({
  babelHelpers: 'bundled',
  extensions: ['.tsx'],
  include: ['src/**/*.tsx'],
  parserOpts: { plugins: ['typescript', 'jsx'] },
  plugins: [['babel-plugin-react-compiler', { target: '19' }]],
  babelrc: false,
  configFile: false,
})

export default defineConfig({
  plugins: [reactCompiler],
  entry: ['src/index.ts', 'src/server.ts', 'src/export.ts'],
  platform: 'neutral',
  format: ['esm'],
  // unbundle = preserveModules: conserva el "use client" de cada fichero
  // (Next App Router) y permite deep imports con tree shaking máximo.
  unbundle: true,
  dts: true, // vía rápida: tsconfig tiene isolatedDeclarations
  // Clases estables y legibles (`dt-headerCell`): son API pública para
  // overrides del consumidor. Sin hash: el prefijo dt- ya evita colisiones.
  css: {
    modules: {
      generateScopedName: 'dt-[local]',
    },
    // Sin inyección: el consumidor importa ./styles.css explícitamente
    // (un único import, opt-in, compatible con RSC y con modo unstyled).
    inject: false,
  },
})
