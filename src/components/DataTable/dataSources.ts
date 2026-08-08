import type {
  ColumnDef,
  DataSource,
  QueryResult,
  QueryState,
  SelectOption,
} from './types'
import { deriveFacets, filterRows, sortRows } from './utils'

/**
 * Modo client: el array completo vive en memoria y filtro/orden/página
 * se resuelven localmente. Memoíza `rows` y `columns` antes de llamar.
 */
export function createClientDataSource<T>(
  rows: T[],
  columns: ColumnDef<T>[],
): DataSource<T> {
  return {
    mode: 'client',
    fetch(query: QueryState): QueryResult<T> {
      const filtered = filterRows(rows, query.filters, query.globalSearch, columns)
      const sorted = sortRows(filtered, query.sorts, columns)
      const total = sorted.length
      if (query.pageSize <= 0) return { rows: sorted, total }
      const start = (query.page - 1) * query.pageSize
      return { rows: sorted.slice(start, start + query.pageSize), total }
    },
    getFacets(columnId: string): SelectOption[] {
      const column = columns.find((c) => c.id === columnId)
      return column ? deriveFacets(rows, column) : []
    },
  }
}

export interface ServerDataSourceOptions<T> {
  /** Recibe el estado completo de la tabla y devuelve la página + el total. */
  fetch: (query: QueryState, signal?: AbortSignal) => Promise<QueryResult<T>>
  /** Opciones de filtro `select` que no se pueden derivar del cliente. */
  facets?: Record<string, SelectOption[]>
}

/**
 * Modo server: la tabla te entrega `{ page, pageSize, sorts[], filters[], globalSearch }`
 * y tú devuelves `{ rows, total }`. El array `sorts` conserva el orden de aplicación,
 * así que se traduce 1:1 a `ORDER BY a ASC, b DESC`.
 */
export function createServerDataSource<T>(options: ServerDataSourceOptions<T>): DataSource<T> {
  return {
    mode: 'server',
    fetch: options.fetch,
    getFacets: (columnId) => options.facets?.[columnId] ?? [],
  }
}

export interface FetchAllOptions {
  /** Tamaño de lote. */
  chunkSize?: number
  /** Tope duro de filas exportadas. */
  maxRows?: number
  signal?: AbortSignal
}

/**
 * Recorre TODOS los resultados de una consulta **por lotes paginados** —
 * nunca un único fetch con todo. Corta al agotar resultados, al llegar a
 * `maxRows` o si el backend devuelve un lote corto.
 */
export async function fetchAllPaginated<T>(
  source: DataSource<T>,
  base: Omit<QueryState, 'page' | 'pageSize'>,
  options: FetchAllOptions = {},
): Promise<T[]> {
  const { chunkSize = 500, maxRows = 50_000, signal } = options
  const out: T[] = []
  for (let page = 1; out.length < maxRows; page++) {
    const result = await source.fetch({ ...base, page, pageSize: chunkSize }, signal)
    out.push(...result.rows)
    if (result.rows.length < chunkSize) break
    if (out.length >= result.total) break
  }
  return out.length > maxRows ? out.slice(0, maxRows) : out
}

/** `sorts` → `"campo:asc,otro:desc"`, listo para un query param. */
export function serializeSorts(query: QueryState): string {
  return query.sorts.map((s) => `${s.id}:${s.dir}`).join(',')
}

/** Convierte el estado en `URLSearchParams` para un backend REST típico. */
export function queryToSearchParams(query: QueryState): URLSearchParams {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  if (query.sorts.length) params.set('sort', serializeSorts(query))
  if (query.globalSearch) params.set('q', query.globalSearch)
  for (const f of query.filters) {
    params.append('filter', `${f.id}:${f.operator}:${JSON.stringify(f.value)}`)
  }
  return params
}
