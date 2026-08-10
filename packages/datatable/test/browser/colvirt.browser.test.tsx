import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable } from '../../src'
import type { ColumnDef } from '../../src'

type Wide = Record<string, unknown> & { id: string }

const COLS = 40
const columns: ColumnDef<Wide>[] = [
  { id: 'id', header: 'ID', accessorKey: 'id', pin: 'left', width: 90 },
  ...Array.from({ length: COLS }, (_, i) => ({
    id: `c${i}`,
    header: `Col ${i}`,
    accessorKey: `c${i}` as never,
    width: 120,
  })),
]

const rows: Wide[] = Array.from({ length: 10 }, (_, r) => ({
  id: `r${r}`,
  ...Object.fromEntries(Array.from({ length: COLS }, (_, c) => [`c${c}`, `v${r}-${c}`])),
}))

const renderedDataHeaders = () =>
  [...document.querySelectorAll('th[data-column-id]')].map((t) =>
    t.getAttribute('data-column-id'),
  )

it('virtualización de columnas: solo pinta la ventana visible + fijadas', async () => {
  render(
    <div style={{ width: 700 }}>
      <DataTable<Wide>
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        persist={false}
        enableColumnVirtualization
        columnOverscan={2}
      />
    </div>,
  )
  await expect.element(page.getByText('v0-0')).toBeInTheDocument()

  const initial = renderedDataHeaders()
  expect(initial).toContain('id') // fijada: siempre
  expect(initial.length).toBeLessThan(COLS / 2) // ni de lejos las 40
  expect(initial).not.toContain('c30')

  // el ancho total (scrollbar) sigue siendo el de TODAS las columnas
  const table = document.querySelector('table')!
  expect(table.getBoundingClientRect().width).toBeGreaterThan(COLS * 120)

  // scroll horizontal → la ventana se desplaza y aparecen columnas lejanas
  const scroller = document.querySelector('table')!.parentElement as HTMLElement
  scroller.scrollLeft = 30 * 120
  await expect.poll(() => renderedDataHeaders()).toContain('c30')
  expect(renderedDataHeaders()).toContain('id') // la fijada no se fue
  expect(renderedDataHeaders()).not.toContain('c2') // la ventana dejó atrás el inicio

  // y las celdas de esa columna existen con su valor
  await expect.element(page.getByText('v0-30')).toBeInTheDocument()
})
