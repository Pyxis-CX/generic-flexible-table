import { describe, expect, it } from 'vitest'
import {
  compareValues,
  createSearchIndex,
  deriveFacets,
  filterRows,
  isFilterActive,
  matchesRule,
  sortRows,
} from '../src/utils'
import type { ColumnDef, FilterRule, SortRule } from '../src/types'

interface Row {
  id: string
  name: string
  age: number | null
  city: string
  active: boolean
  joined: string
}

const columns: ColumnDef<Row>[] = [
  { id: 'id', header: 'ID', accessorKey: 'id' },
  { id: 'name', header: 'Nombre', accessorKey: 'name' },
  { id: 'age', header: 'Edad', accessorKey: 'age' },
  { id: 'city', header: 'Ciudad', accessorKey: 'city' },
  { id: 'active', header: 'Activo', accessorKey: 'active' },
  { id: 'joined', header: 'Alta', accessorKey: 'joined' },
]

const rows: Row[] = [
  { id: 'r1', name: 'Álvaro Núñez', age: 34, city: 'Madrid', active: true, joined: '2021-03-10' },
  { id: 'r2', name: 'beatriz lópez', age: 28, city: 'Barcelona', active: false, joined: '2020-01-15' },
  { id: 'r3', name: 'Carlos Pérez', age: null, city: 'Madrid', active: true, joined: '2022-07-01' },
  { id: 'r4', name: 'Diana Ortiz', age: 41, city: 'Sevilla', active: false, joined: '2019-11-30' },
  { id: 'r5', name: 'item 10', age: 28, city: 'Madrid', active: true, joined: '2021-03-10' },
  { id: 'r6', name: 'item 2', age: 55, city: 'Bilbao', active: true, joined: '2023-02-20' },
]

/* ------------------------------------------------------------------ */
/* sortRows                                                            */
/* ------------------------------------------------------------------ */

describe('sortRows', () => {
  it('ordena números de forma aritmética, vacíos al final', () => {
    const out = sortRows(rows, [{ id: 'age', dir: 'asc' }], columns)
    expect(out.map((r) => r.age)).toEqual([28, 28, 34, 41, 55, null])
  })

  it('multi-criterio respeta el ORDEN de aplicación de las reglas', () => {
    const sorts: SortRule[] = [
      { id: 'city', dir: 'asc' },
      { id: 'age', dir: 'desc' },
    ]
    const out = sortRows(rows, sorts, columns)
    expect(out.map((r) => r.id)).toEqual(['r2', 'r6', 'r1', 'r5', 'r3', 'r4'])
  })

  it('es estable: empates conservan el orden original', () => {
    const out = sortRows(rows, [{ id: 'joined', dir: 'asc' }], columns)
    const empatados = out.filter((r) => r.joined === '2021-03-10').map((r) => r.id)
    expect(empatados).toEqual(['r1', 'r5']) // r1 iba antes en el input
  })

  it('orden natural: item 2 antes que item 10', () => {
    const out = sortRows(rows, [{ id: 'name', dir: 'asc' }], columns)
    const items = out.filter((r) => r.name.startsWith('item')).map((r) => r.name)
    expect(items).toEqual(['item 2', 'item 10'])
  })

  it('ignora reglas de columnas inexistentes y no muta el input', () => {
    const input = [...rows]
    const out = sortRows(input, [{ id: 'nope', dir: 'asc' }], columns)
    expect(out).toBe(input) // sin criterios válidos devuelve la misma referencia
    expect(input.map((r) => r.id)).toEqual(rows.map((r) => r.id))
  })

  it('sortFn custom gana al comparador por defecto', () => {
    const custom: ColumnDef<Row>[] = [
      { id: 'name', header: 'n', accessorKey: 'name', sortFn: (a, b) => a.name.length - b.name.length },
    ]
    const out = sortRows(rows, [{ id: 'name', dir: 'asc' }], custom)
    expect(out[0].name.length).toBeLessThanOrEqual(out[5].name.length)
  })
})

/* ------------------------------------------------------------------ */
/* filterRows / matchesRule                                            */
/* ------------------------------------------------------------------ */

describe('filterRows', () => {
  const f = (rules: FilterRule[], search = '') => filterRows(rows, rules, search, columns)

  it('contains es insensible a mayúsculas y acentos', () => {
    expect(f([{ id: 'name', operator: 'contains', value: 'alvaro' }])).toHaveLength(1)
    expect(f([{ id: 'name', operator: 'contains', value: 'LÓPEZ' }])).toHaveLength(1)
  })

  it('operadores numéricos', () => {
    expect(f([{ id: 'age', operator: 'gte', value: '41' }]).map((r) => r.id)).toEqual(['r4', 'r6'])
    expect(f([{ id: 'age', operator: 'between', value: ['28', '34'] }])).toHaveLength(3)
    expect(f([{ id: 'age', operator: 'lt', value: 30 }])).toHaveLength(2)
  })

  it('null nunca pasa un filtro numérico', () => {
    expect(f([{ id: 'age', operator: 'gte', value: '0' }]).some((r) => r.age === null)).toBe(false)
  })

  it('in con lista (multi-select)', () => {
    expect(f([{ id: 'city', operator: 'in', value: ['Madrid', 'Bilbao'] }])).toHaveLength(4)
  })

  it('booleanos con equals', () => {
    expect(f([{ id: 'active', operator: 'equals', value: false }])).toHaveLength(2)
  })

  it('dateBetween incluye el día final completo', () => {
    const out = f([{ id: 'joined', operator: 'dateBetween', value: ['2021-03-10', '2021-03-10'] }])
    expect(out.map((r) => r.id)).toEqual(['r1', 'r5'])
  })

  it('varias reglas se combinan con AND', () => {
    const out = f([
      { id: 'city', operator: 'equals', value: 'Madrid' },
      { id: 'active', operator: 'equals', value: true },
    ])
    expect(out).toHaveLength(3)
  })

  it('búsqueda global cruza todas las columnas, con y sin índice', () => {
    const sinIndice = filterRows(rows, [], 'sevilla', columns)
    const index = createSearchIndex(rows, columns)
    const conIndice = filterRows(rows, [], 'sevilla', columns, index)
    expect(sinIndice.map((r) => r.id)).toEqual(['r4'])
    expect(conIndice.map((r) => r.id)).toEqual(['r4'])
  })

  it('reglas vacías se ignoran (isFilterActive)', () => {
    expect(isFilterActive({ id: 'x', operator: 'contains', value: '' })).toBe(false)
    expect(isFilterActive({ id: 'x', operator: 'in', value: [] })).toBe(false)
    expect(isFilterActive({ id: 'x', operator: 'between', value: ['', ''] })).toBe(false)
    expect(isFilterActive({ id: 'x', operator: 'between', value: ['1', ''] })).toBe(true)
    expect(f([{ id: 'name', operator: 'contains', value: '' }])).toHaveLength(rows.length)
  })

  it('sin filtros activos devuelve la misma referencia (memo-friendly)', () => {
    const input = [...rows]
    expect(filterRows(input, [], '', columns)).toBe(input)
  })

  it('filterFn custom', () => {
    const custom: ColumnDef<Row>[] = [
      { id: 'name', header: 'n', accessorKey: 'name', filterFn: (row) => row.name.includes('item') },
    ]
    const out = filterRows(rows, [{ id: 'name', operator: 'contains', value: 'x' }], '', custom)
    expect(out).toHaveLength(2)
  })
})

describe('matchesRule (operadores de texto)', () => {
  it.each([
    ['startsWith', 'álv', 'Álvaro', true],
    ['endsWith', 'ñez', 'Núñez', true],
    ['notContains', 'zzz', 'Álvaro', true],
    ['notEquals', 'alvaro', 'Álvaro', false], // igualdad normalizada → notEquals falso
  ] as const)('%s(%s) sobre %s → %s', (operator, value, target, expected) => {
    expect(matchesRule(target, { id: 'x', operator, value })).toBe(expected)
  })
})

/* ------------------------------------------------------------------ */
/* Varios                                                              */
/* ------------------------------------------------------------------ */

describe('compareValues', () => {
  it('vacíos siempre al final', () => {
    expect(compareValues(null, 5)).toBe(1)
    expect(compareValues(5, undefined)).toBe(-1)
    expect(compareValues('', '')).toBe(0)
  })
})

describe('deriveFacets', () => {
  it('valores únicos ordenados por etiqueta', () => {
    const facets = deriveFacets(rows, columns[3])
    expect(facets.map((f) => f.value)).toEqual(['Barcelona', 'Bilbao', 'Madrid', 'Sevilla'])
  })
})

describe('createSearchIndex', () => {
  it('el índice de columna refleja los valores normalizados', () => {
    const index = createSearchIndex(rows, columns)
    const nombres = index.column('name')!
    expect(nombres[0]).toContain('alvaro nunez')
    expect(index.column('inexistente')).toBeNull()
  })
})
