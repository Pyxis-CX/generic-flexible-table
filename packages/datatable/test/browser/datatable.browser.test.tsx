import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable } from '../../src'
import type { ColumnDef } from '../../src'
import '../../src/tokens.css'

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

const firstCellTexts = () =>
  [...document.querySelectorAll('tbody tr[data-row="1"]')].map(
    (tr) => tr.querySelector('td')?.textContent?.trim() ?? '',
  )

it('renderiza, ordena al clic y acumula multi-orden con numeración', async () => {
  render(
    <DataTable<Fruit>
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      persist={false}
      enableVirtualization={false}
    />,
  )

  await expect.element(page.getByText('manzana')).toBeInTheDocument()

  // clic en "Fruta" → asc alfabético
  await page.getByRole('button', { name: /^Fruta\./ }).click()
  expect(firstCellTexts()).toEqual(['ciruela', 'manzana', 'pera'])

  // clic en "Kilos" → se ACUMULA (no reemplaza) y aparece la barra numerada
  await page.getByRole('button', { name: /^Kilos\./ }).click()
  await expect.element(page.getByText('Orden aplicado')).toBeInTheDocument()
  const chips = [...document.querySelectorAll('li[class*="sortChip"]')].map((li) =>
    li.textContent?.replace(/\s+/g, ' ').trim(),
  )
  expect(chips.some((c) => c?.includes('1. Fruta'))).toBe(true)
  expect(chips.some((c) => c?.includes('2. Kilos'))).toBe(true)
})

it('la selección de una fila no re-renderiza el resto (mutaciones quirúrgicas)', async () => {
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

  const tbody = document.querySelector('tbody')!
  let mutations = 0
  const observer = new MutationObserver((list) => {
    mutations += list.length
  })
  observer.observe(tbody, { childList: true, subtree: true, attributes: true })

  await page.getByRole('checkbox', { name: 'Seleccionar fila' }).first().click()
  await new Promise((r) => setTimeout(r, 50))
  observer.disconnect()

  // 1 fila tocada: un puñado de mutaciones, no el tbody entero (~45 celdas)
  expect(mutations).toBeGreaterThan(0)
  expect(mutations).toBeLessThan(12)
})

it('filtro de columna reduce las filas', async () => {
  render(
    <DataTable<Fruit>
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      persist={false}
    />,
  )
  await page.getByRole('searchbox', { name: 'Filtrar Fruta' }).fill('per')
  // debounce de 300 ms
  await expect.poll(() => firstCellTexts(), { timeout: 2000 }).toEqual(['pera'])
})
