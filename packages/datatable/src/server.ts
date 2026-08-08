// Entry sin React ni "use client": importable en Server Components,
// route handlers y Node. Adapters de datos + motor puro.

export {
  createClientDataSource,
  createServerDataSource,
  fetchAllPaginated,
  queryToSearchParams,
  serializeSorts,
} from './dataSources'
export type { FetchAllOptions, ServerDataSourceOptions } from './dataSources'

/* Motor puro: útil para implementar el adapter en el backend (BFF en Node). */
export {
  compareValues,
  createSearchIndex,
  deriveFacets,
  filterRows,
  isFilterActive,
  matchesRule,
  sortRows,
} from './utils'
export type { SearchIndex } from './utils'

export type {
  ColumnDef,
  DataSource,
  FilterOperator,
  FilterRule,
  QueryResult,
  QueryState,
  SelectOption,
  SortDir,
  SortRule,
} from './types'
