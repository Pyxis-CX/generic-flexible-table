import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable } from '../../src'
import type { ColumnDef } from '../../src'

interface Fila {
  id: string
  v: string
}

const LARGO = 'Presupuesto consolidado interanual por departamento'
const rows: Fila[] = [{ id: 'r1', v: 'x' }]

const cols = (extra?: Partial<ColumnDef<Fila>>): ColumnDef<Fila>[] => [
  { id: 'largo', header: LARGO, accessorKey: 'v', width: 120, ...extra },
  { id: 'otro', header: 'Otro', accessorKey: 'v', width: 100 },
]

const titulo = () =>
  document.querySelector('th[data-column-id="largo"] [class*="title"]') as HTMLElement
const th = () => document.querySelector('th[data-column-id="largo"]') as HTMLElement

it('por defecto el título ENVUELVE: sin elipsis, texto completo visible', async () => {
  render(<DataTable<Fila> columns={cols()} rows={rows} getRowId={(r) => r.id} persist={false} />)
  await expect.element(page.getByText('Otro')).toBeInTheDocument()

  const cs = getComputedStyle(titulo())
  expect(cs.whiteSpace).not.toBe('nowrap')
  expect(cs.textOverflow).not.toBe('ellipsis')
  // envuelve de verdad: más alto que una línea
  // envuelve de verdad: alto de varias líneas (vs una sola ~1.4×fontSize)
  expect(titulo().getBoundingClientRect().height).toBeGreaterThan(parseFloat(cs.fontSize) * 2)
  // sin tooltip (no hay recorte que explicar)
  expect(th().getAttribute('title')).toBeNull()
  // la fila de filtros/medición: la var refleja la cabecera crecida
  const root = document.querySelector('[class*="dt-root"], [class*="root"]') as HTMLElement
  const medida = parseFloat(root.style.getPropertyValue('--dt-measured-header-h'))
  expect(medida).toBeGreaterThan(44) // > --dt-header-height base
})

it('truncateHeader por columna: elipsis + tooltip nativo con el texto completo', async () => {
  render(
    <DataTable<Fila>
      columns={cols({ truncateHeader: true })}
      rows={rows}
      getRowId={(r) => r.id}
      persist={false}
    />,
  )
  await expect.element(page.getByText('Otro')).toBeInTheDocument()

  const cs = getComputedStyle(titulo())
  expect(cs.whiteSpace).toBe('nowrap')
  expect(cs.textOverflow).toBe('ellipsis')
  expect(th().getAttribute('title')).toBe(LARGO)
})

it('truncateHeaders global; headerTooltip propio NO se pisa', async () => {
  render(
    <DataTable<Fila>
      columns={cols({ headerTooltip: 'Mi tooltip' })}
      rows={rows}
      getRowId={(r) => r.id}
      persist={false}
      truncateHeaders
    />,
  )
  await expect.element(page.getByText('Otro')).toBeInTheDocument()
  expect(getComputedStyle(titulo()).textOverflow).toBe('ellipsis')
  expect(th().getAttribute('title')).toBe('Mi tooltip') // el del usuario gana
  // y la otra columna también truncada por el flag global
  const otro = document.querySelector('th[data-column-id="otro"] [class*="title"]') as HTMLElement
  expect(getComputedStyle(otro).whiteSpace).toBe('nowrap')
})
