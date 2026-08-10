import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable } from '../../src'
import type { ColumnDef, TableState } from '../../src'
import { buildTableState } from '../../src/state'

interface Fruit {
  id: string
  name: string
  kg: number
}

const columns: ColumnDef<Fruit>[] = [
  { id: 'name', header: 'Fruta', accessorKey: 'name' },
  { id: 'kg', header: 'Kilos', accessorKey: 'kg' },
]

const rows: Fruit[] = [
  { id: 'f1', name: 'manzana', kg: 3 },
  { id: 'f2', name: 'pera', kg: 1 },
  { id: 'f3', name: 'ciruela', kg: 2 },
]

const firstCol = () =>
  [...document.querySelectorAll('tbody tr[data-row="1"]')].map(
    (tr) => tr.querySelector('td')?.textContent?.trim() ?? '',
  )

it('modo controlado: el estado vive fuera y el ciclo no entra en bucle', async () => {
  const renders = vi.fn()
  let lastState: TableState | null = null

  function Controlled() {
    const [state, setState] = useState<TableState>(() => buildTableState(columns))
    renders()
    lastState = state
    return (
      <DataTable<Fruit>
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        state={state}
        onStateChange={setState}
      />
    )
  }

  render(<Controlled />)
  await expect.element(page.getByText('manzana')).toBeInTheDocument()

  // interacción → la tabla emite → el useState EXTERNO es la fuente de verdad
  await page.getByRole('button', { name: /^Fruta\./ }).click()
  await expect.poll(() => firstCol()).toEqual(['ciruela', 'manzana', 'pera'])
  expect(lastState!.sorts).toEqual([{ id: 'name', dir: 'asc' }])

  // sin bucle: el nº de renders del wrapper queda acotado
  await new Promise((r) => setTimeout(r, 250))
  const after = renders.mock.calls.length
  await new Promise((r) => setTimeout(r, 250))
  expect(renders.mock.calls.length).toBe(after)
})

it('modo controlado: cambiar el estado desde FUERA mueve la tabla', async () => {
  function ExternalDriver() {
    const [state, setState] = useState<TableState>(() => buildTableState(columns))
    return (
      <>
        <button
          type="button"
          onClick={() =>
            setState((prev) => ({ ...prev, sorts: [{ id: 'kg', dir: 'desc' }] }))
          }
        >
          ordenar por kilos desde fuera
        </button>
        <DataTable<Fruit>
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          state={state}
          onStateChange={setState}
        />
      </>
    )
  }

  render(<ExternalDriver />)
  await expect.element(page.getByText('manzana')).toBeInTheDocument()

  await page.getByRole('button', { name: 'ordenar por kilos desde fuera' }).click()
  await expect.poll(() => firstCol()).toEqual(['manzana', 'ciruela', 'pera'])
  // y la cabecera refleja el orden que vino de fuera
  const th = document.querySelector('th[data-column-id="kg"]')
  expect(th?.getAttribute('aria-sort')).toBe('descending')
})
