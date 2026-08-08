import { bench, describe } from 'vitest'
import { createSearchIndex, filterRows, sortRows } from '../src/utils'
import type { ColumnDef, FilterRule, SortRule } from '../src/types'

interface Row {
  id: string
  name: string
  dept: string
  salary: number
  date: string
}

const columns: ColumnDef<Row>[] = [
  { id: 'id', header: 'ID', accessorKey: 'id' },
  { id: 'name', header: 'N', accessorKey: 'name' },
  { id: 'dept', header: 'D', accessorKey: 'dept' },
  { id: 'salary', header: 'S', accessorKey: 'salary' },
  { id: 'date', header: 'F', accessorKey: 'date' },
]

// PRNG determinista: mismas filas en cada run → comparable entre commits.
let seed = 42
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

const DEPTS = ['ing', 'ventas', 'rrhh', 'producto', 'soporte']
const rows: Row[] = Array.from({ length: 50_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Persona Número ${Math.floor(rand() * 10_000)}`,
  dept: DEPTS[Math.floor(rand() * DEPTS.length)],
  salary: Math.floor(rand() * 90_000),
  date: `20${10 + Math.floor(rand() * 16)}-0${1 + Math.floor(rand() * 8)}-15`,
}))

const sorts: SortRule[] = [
  { id: 'dept', dir: 'asc' },
  { id: 'salary', dir: 'desc' },
]
const filters: FilterRule[] = [{ id: 'dept', operator: 'in', value: ['ing', 'ventas'] }]

const index = createSearchIndex(rows, columns)
index.haystack(0) // calentar: el coste de construcción no entra en los benches

describe('pipeline 50k filas', () => {
  bench('filterRows (1 regla in)', () => {
    filterRows(rows, filters, '', columns, index)
  })

  const filtered = filterRows(rows, filters, '', columns, index)

  bench('sortRows (2 criterios, claves precalculadas)', () => {
    sortRows(filtered, sorts, columns)
  })

  bench('búsqueda global con índice caliente', () => {
    filterRows(rows, [], 'persona numero 42', columns, index)
  })

  const sorted = sortRows(filtered, sorts, columns)

  bench('paginar = slice', () => {
    sorted.slice(25_000, 25_050)
  })
})
