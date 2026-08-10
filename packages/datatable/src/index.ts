// Entry de cliente: el componente, las parts componibles y los hooks del store.
// Los estilos son opt-in: `import '@list-dragable/datatable/styles.css'`.

export { DataTable } from './DataTable'

/* Parts componibles: monta tu propia tabla y estiliza/reemplaza cada pieza. */
export { Toolbar } from './parts/Toolbar'
export { SortBar } from './parts/SortBar'
export { Footer } from './parts/Footer'
export { BodyRow } from './parts/BodyRow'
export { HeaderCell } from './parts/HeaderCell'
export { FilterControl } from './parts/FilterControl'
export { Popover } from './parts/Popover'

/* Store: suscríbete a cualquier porción del estado desde tus propios componentes. */
export {
  useTableStore,
  useTableSelector,
  useTableDispatch,
  useIsSelected,
  useIsExpanded,
  useSortEntry,
  createTableStore,
} from './store'
export type { TableStore, SortEntry } from './store'
export { useTableConfig, useTableData } from './context'
export type { TableConfig, TableData, TableFlags } from './context'
export type { RuntimeState, TableAction, InteractionState } from './state'
/** Construye un TableState inicial válido para el modo controlado. */
export { buildTableState } from './state'

export { DEFAULT_LABELS } from './utils'
export { localStorageAdapter } from './persistence'
export type { PersistenceAdapter, PersistedTableState } from './persistence'

export type {
  Align,
  CellContext,
  ColumnDef,
  ColumnFilterConfig,
  DataSource,
  DataTableProps,
  Density,
  ExportScope,
  FilterKind,
  FilterOperator,
  FilterRule,
  HeaderContext,
  PaginationContext,
  PinSide,
  QueryResult,
  QueryState,
  SelectOption,
  SortDir,
  SortRule,
  TableClassNames,
  TableLabels,
  TableSlots,
  TableState,
  ThemeTokens,
  ToolbarContext,
} from './types'
