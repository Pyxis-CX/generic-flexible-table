'use client'

import { createContext, useContext } from 'react'
import type { Context } from 'react'
import type { MouseEvent, ReactNode, RefObject } from 'react'
import type {
  ColumnDef,
  ExportScope,
  SelectOption,
  TableClassNames,
  TableLabels,
  TableSlots,
} from './types'

/**
 * Dos contextos, dos ritmos de cambio:
 *
 *  - `ConfigContext`: derivado solo de props. Estable mientras el consumidor
 *    memoice sus render props. Lo consumen las filas.
 *  - `DataContext`: resultado del pipeline + flags volátiles (loading,
 *    exporting). Lo consumen las piezas estructurales (toolbar, footer,
 *    filtros), NUNCA las filas — así una recarga no re-renderiza el cuerpo
 *    salvo que cambien las filas visibles.
 *
 * El estado interactivo no viaja por contexto: cada componente se suscribe
 * al store por selector (ver store.ts). Cero prop drilling.
 */

export interface TableFlags {
  enableColumnReorder: boolean
  enableColumnResize: boolean
  enableColumnPinning: boolean
  enableColumnVisibility: boolean
  enableMultiSort: boolean
  enableGlobalSearch: boolean
  enableRowSelection: boolean
  enableDensityToggle: boolean
  enableExport: boolean
  enablePagination: boolean
  stickyHeader: boolean
  stripedRows: boolean
}

export interface TableConfig<T> {
  columns: ColumnDef<T>[]
  columnById: Map<string, ColumnDef<T>>
  getRowId: (row: T, index: number) => string
  labels: TableLabels
  flags: TableFlags
  multiSortMode: 'accumulate' | 'modifier'
  pageSizeOptions: number[]
  classNames?: TableClassNames
  slots?: TableSlots<T>
  onRowClick?: (row: T, index: number, event: MouseEvent) => void
  onRowDoubleClick?: (row: T, index: number, event: MouseEvent) => void
  rowClassName?: (row: T, index: number) => string | undefined
  renderRowActions?: (row: T, index: number) => ReactNode
  renderExpanded?: (row: T, index: number) => ReactNode
  /** Raíz de la tabla: destino de las CSS vars transitorias del resize. */
  rootRef: RefObject<HTMLDivElement | null>
}

export interface TableData<T> {
  pageRows: T[]
  pageRowIds: string[]
  total: number
  pageCount: number
  loading: boolean
  error: Error | null
  exporting: boolean
  refetch: () => void
  reset: () => void
  onExport: (format: 'csv' | 'pdf', scope: ExportScope) => void
  facets: (columnId: string) => SelectOption[]
}

export const ConfigContext: Context<unknown> = createContext<unknown>(null)
export const DataContext: Context<unknown> = createContext<unknown>(null)

export function useTableConfig<T>(): TableConfig<T> {
  const value = useContext(ConfigContext)
  if (!value) throw new Error('DataTable: useTableConfig fuera de la tabla')
  return value as TableConfig<T>
}

export function useTableData<T>(): TableData<T> {
  const value = useContext(DataContext)
  if (!value) throw new Error('DataTable: useTableData fuera de la tabla')
  return value as TableData<T>
}
