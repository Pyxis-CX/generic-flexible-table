import { defineConfig } from 'tsdown'

export default defineConfig({
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
