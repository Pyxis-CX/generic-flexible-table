import { expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable } from '../../src'
import type { ColumnDef } from '../../src'

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

const activeCellText = () =>
  (document.activeElement as HTMLElement)?.textContent?.trim() ?? ''

it('grid ARIA: roving tabindex y navegación con flechas', async () => {
  render(
    <DataTable<Fruit>
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      persist={false}
      enableRowSelection
    />,
  )
  await expect.element(page.getByText('manzana')).toBeInTheDocument()

  // semántica
  expect(document.querySelector('table')?.getAttribute('role')).toBe('grid')
  expect(document.querySelector('table')?.getAttribute('aria-colcount')).toBe('3')

  // exactamente UN tabstop en el cuerpo
  const stops = document.querySelectorAll('tbody td[tabindex="0"]')
  expect(stops).toHaveLength(1)

  // foco inicial + flechas
  ;(stops[0] as HTMLElement).focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(activeCellText()).toContain('manzana')
  await userEvent.keyboard('{ArrowDown}')
  expect(activeCellText()).toContain('pera')
  await userEvent.keyboard('{End}')
  expect(activeCellText()).toContain('1') // kilos de pera
  await userEvent.keyboard('{Home}')
  await userEvent.keyboard('{Control>}{End}{/Control}')
  expect(activeCellText()).toContain('2') // última celda del cuerpo: kilos de ciruela

  // el tabstop se movió con el foco (roving)
  expect(document.querySelectorAll('tbody td[tabindex="0"]')).toHaveLength(1)
})

it('Enter sobre la celda activa acciona su control (checkbox)', async () => {
  render(
    <DataTable<Fruit>
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      persist={false}
      enableRowSelection
    />,
  )
  await expect.element(page.getByText('manzana')).toBeInTheDocument()

  const firstCell = document.querySelector<HTMLElement>('tbody td[tabindex="0"]')!
  firstCell.focus()
  await userEvent.keyboard('{Enter}')

  const checkbox = firstCell.querySelector<HTMLInputElement>('input[type="checkbox"]')
  expect(checkbox?.checked).toBe(true)
})
