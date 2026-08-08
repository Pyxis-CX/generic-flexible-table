import type { ColumnDef, QueryResult, QueryState } from '@list-dragable/datatable'
import { filterRows, sortRows } from '@list-dragable/datatable/server'
import type { Employee } from './data'

/**
 * Backend falso. Recibe exactamente el `QueryState` que emite la tabla y
 * devuelve `{ rows, total }`, igual que haría un endpoint real:
 *
 *   GET /employees?page=2&pageSize=25&sort=department:asc,salary:desc&filter=...
 */
export function createMockApi(dataset: Employee[], columns: ColumnDef<Employee>[]) {
  let failNext = false

  return {
    /** Fuerza un error en la próxima llamada, para ver el estado de error. */
    breakNext: () => {
      failNext = true
    },
    fetch(query: QueryState, signal?: AbortSignal): Promise<QueryResult<Employee>> {
      const latency = 220 + (query.page % 3) * 90

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (failNext) {
            failNext = false
            reject(new Error('El servidor devolvió 503. Inténtalo de nuevo.'))
            return
          }
          const filtered = filterRows(dataset, query.filters, query.globalSearch, columns)
          const sorted = sortRows(filtered, query.sorts, columns)
          const total = sorted.length
          const rows =
            query.pageSize <= 0
              ? sorted
              : sorted.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
          resolve({ rows, total })
        }, latency)

        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    },
  }
}
