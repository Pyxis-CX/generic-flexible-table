import { afterAll, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTable, createWorkerDataSource } from '../../src'
import type { ColumnDef, WorkerDataSource } from '../../src'

interface Person extends Record<string, unknown> {
  id: string
  name: string
  score: number
  team: string
}

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Nombre', accessorKey: 'name' },
  { id: 'score', header: 'Puntos', accessorKey: 'score' },
  { id: 'team', header: 'Equipo', accessorKey: 'team' },
]

// 30k filas deterministas: suficiente para probar el pipeline sin eternizar CI
const rows: Person[] = Array.from({ length: 30_000 }, (_, i) => ({
  id: `p${i}`,
  name: `Persona Número ${(i * 7919) % 10_000}`,
  score: (i * 31) % 1000,
  team: ['álfa', 'beta', 'gamma'][i % 3],
}))

let source: WorkerDataSource<Person>
afterAll(() => source?.terminate())

it('createWorkerDataSource: motor completo fuera del main thread', async () => {
  source = createWorkerDataSource(rows, columns)

  // consulta directa: filtro + orden multi + página
  const result = await source.fetch({
    page: 2,
    pageSize: 50,
    sorts: [
      { id: 'team', dir: 'asc' },
      { id: 'score', dir: 'desc' },
    ],
    filters: [{ id: 'team', operator: 'in', value: ['alfa'] }], // sin acento: normaliza
    globalSearch: '',
  })

  expect(result.total).toBe(10_000) // un tercio de 30k
  expect(result.rows).toHaveLength(50)
  // orden desc por score dentro del equipo: página 2 sigue la escalera
  const scores = result.rows.map((r) => r.score)
  expect([...scores].sort((a, b) => b - a)).toEqual(scores)

  // y montada en la tabla: pinta y pagina
  render(
    <DataTable<Person>
      columns={columns}
      dataSource={source}
      getRowId={(r) => r.id}
      persist={false}
    />,
  )
  await expect.element(page.getByText(/1–25 de 30\s?000|1–25 de 30,000|1–25 de 30\.000/)).toBeInTheDocument()
})

it('la búsqueda global también resuelve en el worker', async () => {
  const result = await source.fetch({
    page: 1,
    pageSize: 10,
    sorts: [],
    filters: [],
    globalSearch: 'persona número 42',
    // eslint-disable-next-line
  } as never)
  expect(result.total).toBeGreaterThan(0)
  expect(result.rows[0].name.toLowerCase()).toContain('número 42')
})
