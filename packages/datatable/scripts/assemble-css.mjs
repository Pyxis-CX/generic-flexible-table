// Ensambla dist/styles.css = tokens (sin hashear) + todos los .css que
// emitió tsdown al compilar los CSS Modules. Un único import para el
// consumidor: `import '@list-dragable/datatable/styles.css'`.
import { readFile, readdir, writeFile, copyFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIST = new URL('../dist/', import.meta.url).pathname
const SRC = new URL('../src/', import.meta.url).pathname

async function findCss(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await findCss(full)))
    else if (
      entry.name.endsWith('.css') &&
      entry.name !== 'styles.css' &&
      entry.name !== 'tokens.css' // copia propia de un build anterior, no re-ingerir
    )
      out.push(full)
  }
  return out
}

const tokens = await readFile(join(SRC, 'tokens.css'), 'utf8')
const emitted = await findCss(DIST)
const parts = await Promise.all(emitted.map((f) => readFile(f, 'utf8')))

const banner = `/* @list-dragable/datatable — estilos. Todo vive en @layer datatable:\n * cualquier regla tuya SIN layer gana en especificidad. Tokens: --dt-*. */\n`
await writeFile(join(DIST, 'styles.css'), banner + tokens + '\n' + parts.join('\n'))

// tokens.css también disponible por separado (tema sin estructura).
await copyFile(join(SRC, 'tokens.css'), join(DIST, 'tokens.css'))

console.log(`styles.css: tokens + ${emitted.length} módulos CSS compilados`)
