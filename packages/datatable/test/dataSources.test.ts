import { describe, expect, it } from 'vitest'
import {
  createClientDataSource,
  createServerDataSource,
  fetchAllPaginated,
  queryToSearchParams,
  serializeSorts,
} from '../src/dataSources'
import type { ColumnDef, QueryState } from '../src/types'

interface Row {
  n: number
  group: string
}

const columns: ColumnDef<Row>[] = [
  { id: 'n', header: 'N', accessorKey: 'n' },
  { id: 'group', header: 'G', accessorKey: 'group' },
]

const dataset: Row[] = Array.from({ length: 95 }, (_, i) => ({
  n: i,
  group: i % 2 ? 'impar' : 'par',
}))

const query = (patch: Partial<QueryState> = {}): QueryState => ({
  page: 1,
  pageSize: 10,
  sorts: [],
  filters: [],
  globalSearch: '',
  ...patch,
})

describe('createClientDataSource', () => {
  const source = createClientDataSource(dataset, columns)

  it('pagina y devuelve el total FILTRADO, no el del dataset', () => {
    const result = source.fetch(
      query({ filters: [{ id: 'group', operator: 'equals', value: 'par' }], page: 2 }),
    )
    if (result instanceof Promise) throw new Error('client debe ser síncrono')
    expect(result.total).toBe(48)
    expect(result.rows).toHaveLength(10)
    expect(result.rows[0].n).toBe(20) // página 2 de los pares
  })

  it('pageSize 0 = sin paginar', () => {
    const result = source.fetch(query({ pageSize: 0 }))
    if (result instanceof Promise) throw new Error('sync')
    expect(result.rows).toHaveLength(95)
  })

  it('getFacets deriva opciones únicas', () => {
    expect(source.getFacets!('group').map((f) => f.value).sort()).toEqual(['impar', 'par'])
  })
})

describe('fetchAllPaginated — jamás traer todo de golpe', () => {
  const TOTAL = 5000
  const makeSource = (calls: { page: number; pageSize: number }[]) =>
    createServerDataSource<Row>({
      fetch: async (q) => {
        calls.push({ page: q.page, pageSize: q.pageSize })
        const start = (q.page - 1) * q.pageSize
        const size = Math.max(0, Math.min(q.pageSize, TOTAL - start))
        return {
          rows: Array.from({ length: size }, (_, i) => ({ n: start + i, group: '' })),
          total: TOTAL,
        }
      },
    })

  it('recorre en lotes del chunkSize, nunca un request gigante', async () => {
    const calls: { page: number; pageSize: number }[] = []
    const rows = await fetchAllPaginated(makeSource(calls), query(), { chunkSize: 500 })
    expect(rows).toHaveLength(5000)
    expect(calls).toHaveLength(10)
    expect(new Set(calls.map((c) => c.pageSize))).toEqual(new Set([500]))
    expect(rows[0].n).toBe(0)
    expect(rows[4999].n).toBe(4999) // orden intacto
  })

  it('respeta maxRows', async () => {
    const calls: { page: number; pageSize: number }[] = []
    const rows = await fetchAllPaginated(makeSource(calls), query(), {
      chunkSize: 500,
      maxRows: 1200,
    })
    expect(rows).toHaveLength(1200)
    expect(calls).toHaveLength(3)
  })

  it('corta al recibir un lote corto (fin de datos)', async () => {
    const calls: { page: number }[] = []
    const small = createServerDataSource<Row>({
      fetch: async (q) => {
        calls.push({ page: q.page })
        return q.page === 1
          ? { rows: Array.from({ length: 137 }, (_, i) => ({ n: i, group: '' })), total: 137 }
          : { rows: [], total: 137 }
      },
    })
    const rows = await fetchAllPaginated(small, query(), { chunkSize: 500 })
    expect(rows).toHaveLength(137)
    expect(calls).toHaveLength(1)
  })
})

describe('serialización para backends REST', () => {
  it('serializeSorts conserva el orden de aplicación (→ ORDER BY posicional)', () => {
    expect(
      serializeSorts(query({ sorts: [{ id: 'b', dir: 'desc' }, { id: 'a', dir: 'asc' }] })),
    ).toBe('b:desc,a:asc')
  })

  it('queryToSearchParams', () => {
    const params = queryToSearchParams(
      query({
        page: 3,
        sorts: [{ id: 'n', dir: 'asc' }],
        filters: [{ id: 'group', operator: 'equals', value: 'par' }],
        globalSearch: 'algo',
      }),
    )
    expect(params.get('page')).toBe('3')
    expect(params.get('sort')).toBe('n:asc')
    expect(params.get('q')).toBe('algo')
    expect(params.get('filter')).toBe('group:equals:"par"')
  })
})
