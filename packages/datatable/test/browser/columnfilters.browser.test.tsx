import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable, buildTableState } from '../../src'
import type { ColumnDef } from '../../src'

interface Fruit {
  id: string
  name: string
  kg: number
}

const columns: ColumnDef<Fruit>[] = [
  { id: 'name', header: 'Fruta', accessorKey: 'name', filter: { kind: 'text' } },
  { id: 'kg', header: 'Kilos', accessorKey: 'kg', filter: { kind: 'number' } },
]

const rows: Fruit[] = [
  { id: 'f1', name: 'manzana', kg: 3 },
  { id: 'f2', name: 'pera', kg: 1 },
  { id: 'f3', name: 'ciruela', kg: 2 },
]

it('enableColumnFilters=false: sin fila de filtros Y las reglas se ignoran', async () => {
  // estado con un filtro YA activo: apagado el flag, no debe aplicarse
  const state = {
    ...buildTableState(columns),
    filters: [{ id: 'name', operator: 'contains' as const, value: 'per' }],
  }
  render(
    <DataTable<Fruit>
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      persist={false}
      enableColumnFilters={false}
      state={state}
      onStateChange={() => {}}
    />,
  )
  await expect.element(page.getByText('manzana')).toBeInTheDocument()
  // las 3 filas visibles: la regla 'per' NO filtró
  expect(document.querySelectorAll('tbody tr[data-row="1"]')).toHaveLength(3)
  // y no existe la fila de filtros
  expect(document.querySelector('input[aria-label="Filtrar Fruta"]')).toBeNull()
})

it('per-columna: filter omitido o kind none = esa columna sin filtro', async () => {
  const mixtas: ColumnDef<Fruit>[] = [
    { id: 'name', header: 'Fruta', accessorKey: 'name', filter: { kind: 'text' } },
    { id: 'kg', header: 'Kilos', accessorKey: 'kg' }, // sin filter
  ]
  render(
    <DataTable<Fruit> columns={mixtas} rows={rows} getRowId={(r) => r.id} persist={false} />,
  )
  await expect.element(page.getByText('manzana')).toBeInTheDocument()
  expect(document.querySelector('input[aria-label="Filtrar Fruta"]')).not.toBeNull()
  expect(document.querySelector('input[aria-label="Filtrar Kilos"]')).toBeNull()
})
