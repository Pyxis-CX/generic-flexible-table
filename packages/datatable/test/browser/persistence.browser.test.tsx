import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable } from '../../src'
import type { ColumnDef, PersistedTableState, PersistenceAdapter } from '../../src'

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
]

// Compartido entre los dos tests (mismo fichero = mismo worker, en orden).
const saved = new Map<string, PersistedTableState>()
const adapter: PersistenceAdapter = {
  // async a propósito: simula IndexedDB/backend
  read: async (key) => saved.get(key) ?? null,
  write: (key, _v, state) => {
    saved.set(key, state)
  },
  clear: (key) => {
    saved.delete(key)
  },
}

const mount = () =>
  render(
    <DataTable<Fruit>
      tableId="frutas"
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      persistence={adapter}
    />,
  )

it('el adapter recibe las escrituras al interactuar', async () => {
  mount()
  await expect.element(page.getByText('manzana')).toBeInTheDocument()
  await page.getByRole('button', { name: /^Kilos\./ }).click()
  await expect.poll(() => saved.get('dt:frutas')?.sorts).toEqual([{ id: 'kg', dir: 'asc' }])
})

it('una instancia nueva rehidrata desde el read asíncrono', async () => {
  expect(saved.get('dt:frutas')?.sorts).toEqual([{ id: 'kg', dir: 'asc' }]) // del test anterior
  mount()
  await expect.element(page.getByText('manzana')).toBeInTheDocument()
  await expect
    .poll(() => document.querySelector('th[data-column-id="kg"]')?.getAttribute('aria-sort'))
    .toBe('ascending')
  // y la escritura post-hidratación NO pisó lo guardado
  expect(saved.get('dt:frutas')?.sorts).toEqual([{ id: 'kg', dir: 'asc' }])
})
