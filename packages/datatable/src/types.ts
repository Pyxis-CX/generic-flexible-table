import type { CSSProperties, ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

export type SortDir = 'asc' | 'desc'

/** Una regla de orden. El array `SortRule[]` conserva el orden de aplicación. */
export interface SortRule {
  id: string
  dir: SortDir
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export type FilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'dateBetween'

export type FilterKind = 'text' | 'number' | 'select' | 'date' | 'boolean' | 'none'

export interface FilterRule {
  id: string
  operator: FilterOperator
  value: unknown
}

export interface SelectOption {
  label: string
  value: string
}

export interface FilterRenderContext<T> {
  column: ColumnDef<T>
  rule: FilterRule | undefined
  setRule: (rule: FilterRule | undefined) => void
}

export interface ColumnFilterConfig<T = unknown> {
  kind: FilterKind
  placeholder?: string
  /** Opciones para `kind: 'select'`. Si se omite se derivan de los datos en modo client. */
  options?: SelectOption[]
  /** Operadores ofrecidos en el selector. Si hay uno solo, no se muestra selector. */
  operators?: FilterOperator[]
  defaultOperator?: FilterOperator
  /** Escotilla de escape: reemplaza por completo el control del filtro. */
  render?: (ctx: FilterRenderContext<T>) => ReactNode
}

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

export type PinSide = 'left' | 'right'
export type Align = 'left' | 'center' | 'right'
export type Density = 'compact' | 'normal' | 'comfortable'

export interface CellContext<T> {
  value: unknown
  row: T
  rowIndex: number
  column: ColumnDef<T>
}

export interface HeaderContext<T> {
  column: ColumnDef<T>
  /** 1-based. 0 si la columna no participa del orden. */
  sortIndex: number
  sortDir: SortDir | null
}

export interface ColumnDef<T> {
  /** Identificador único y estable. Se usa para orden, ancho, pin, persistencia. */
  id: string
  header: ReactNode
  /** Segunda línea bajo el título. */
  subHeader?: ReactNode
  headerTooltip?: string

  accessorKey?: Extract<keyof T, string>
  accessorFn?: (row: T) => unknown

  width?: number
  minWidth?: number
  maxWidth?: number
  align?: Align

  pin?: PinSide
  sortable?: boolean
  resizable?: boolean
  reorderable?: boolean
  hideable?: boolean
  /** Oculta por defecto (el usuario puede mostrarla desde el panel de columnas). */
  hidden?: boolean

  filter?: ColumnFilterConfig<T>

  renderCell?: (ctx: CellContext<T>) => ReactNode
  renderHeader?: (ctx: HeaderContext<T>) => ReactNode
  /** Valor plano: se usa en la celda por defecto y en export CSV/PDF. */
  formatValue?: (value: unknown, row: T) => string

  /** Comparador custom en modo client. */
  sortFn?: (a: T, b: T) => number
  /** Predicado custom en modo client. */
  filterFn?: (row: T, rule: FilterRule) => boolean

  exportable?: boolean
  /** Cabecera en texto plano para CSV/PDF (requerido si `header` no es string). */
  exportHeader?: string

  cellClassName?: string | ((ctx: CellContext<T>) => string | undefined)
  cellStyle?: CSSProperties | ((ctx: CellContext<T>) => CSSProperties | undefined)

  meta?: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* Data source                                                         */
/* ------------------------------------------------------------------ */

export interface QueryState {
  page: number
  pageSize: number
  sorts: SortRule[]
  filters: FilterRule[]
  globalSearch: string
}

export interface QueryResult<T> {
  rows: T[]
  total: number
}

export interface DataSource<T> {
  mode: 'client' | 'server'
  fetch: (query: QueryState, signal?: AbortSignal) => QueryResult<T> | Promise<QueryResult<T>>
  /** Opcional: opciones de filtro derivadas de los datos (modo client). */
  getFacets?: (columnId: string) => SelectOption[]
}

/* ------------------------------------------------------------------ */
/* Tabla: estado persistible                                           */
/* ------------------------------------------------------------------ */

export interface TableState {
  order: string[]
  hidden: string[]
  widths: Record<string, number>
  pins: Record<string, PinSide | null>
  sorts: SortRule[]
  filters: FilterRule[]
  globalSearch: string
  page: number
  pageSize: number
  density: Density
}

/* ------------------------------------------------------------------ */
/* Theming                                                             */
/* ------------------------------------------------------------------ */

/**
 * Tokens de diseño. Cada clave camelCase se inyecta como `--dt-kebab-case`
 * en el elemento raíz, por lo que sobrescribe los defaults de `tokens.css`
 * solo para esa instancia de tabla.
 */
export interface ThemeTokens {
  fontFamily?: string
  fontSize?: string
  fontSizeSm?: string
  headerFontSize?: string
  headerFontWeight?: string
  radius?: string
  radiusSm?: string
  rowHeight?: string
  cellPaddingX?: string
  borderWidth?: string

  colorBg?: string
  colorSurface?: string
  colorSurfaceAlt?: string
  colorHeaderBg?: string
  colorText?: string
  colorTextMuted?: string
  colorBorder?: string
  colorBorderStrong?: string
  colorAccent?: string
  colorAccentSoft?: string
  colorAccentContrast?: string
  colorRowHover?: string
  colorRowSelected?: string
  colorRowStripe?: string
  colorDanger?: string

  shadowPin?: string
  shadowPopover?: string
  focusRing?: string
  transition?: string
}

/* ------------------------------------------------------------------ */
/* Slots / clases                                                      */
/* ------------------------------------------------------------------ */

export interface TableClassNames {
  root?: string
  toolbar?: string
  scroller?: string
  table?: string
  thead?: string
  headerRow?: string
  headerCell?: string
  filterRow?: string
  filterCell?: string
  tbody?: string
  row?: string
  cell?: string
  footer?: string
}

export interface PaginationContext {
  page: number
  pageSize: number
  total: number
  pageCount: number
  setPage: (p: number) => void
  setPageSize: (s: number) => void
}

export interface ToolbarContext<T> {
  state: TableState
  reset: () => void
  refetch: () => void
  rows: T[]
  total: number
  selectedIds: string[]
}

export interface TableSlots<T> {
  /** Contenido cuando no hay filas. */
  empty?: ReactNode | (() => ReactNode)
  loading?: ReactNode
  error?: (error: Error, retry: () => void) => ReactNode
  /** Reemplaza la barra inferior completa. */
  pagination?: (ctx: PaginationContext) => ReactNode
  /** Reemplaza la toolbar completa. */
  toolbar?: (ctx: ToolbarContext<T>) => ReactNode
  /** Reemplaza el icono de orden. */
  sortIndicator?: (dir: SortDir | null, index: number) => ReactNode
}

/* ------------------------------------------------------------------ */
/* Props del componente                                                */
/* ------------------------------------------------------------------ */

export type ExportScope = 'page' | 'all'

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]

  /** Modo client: array completo. Memoízalo. Ignorado si pasas `dataSource`. */
  rows?: T[]
  /** Modo server: adapter async. Memoízalo (o usa `dataSourceKey`). */
  dataSource?: DataSource<T>
  /** Cambia este valor para forzar un refetch sin cambiar la identidad del dataSource. */
  dataSourceKey?: string | number

  getRowId: (row: T, index: number) => string

  /** Necesario para persistir estado en localStorage. */
  tableId?: string
  persist?: boolean
  /** Sube el número para invalidar estado persistido tras un cambio de esquema. */
  persistVersion?: number

  initialState?: Partial<TableState>
  onStateChange?: (state: TableState) => void

  /* features */
  enableColumnReorder?: boolean
  enableColumnResize?: boolean
  enableColumnPinning?: boolean
  enableColumnVisibility?: boolean
  enableMultiSort?: boolean
  /**
   * `accumulate` (por defecto): un clic añade la columna al orden múltiple y
   * conserva las anteriores; Shift/⌘/Ctrl + clic ordena solo por esa columna.
   * `modifier`: al revés — un clic reemplaza, el modificador acumula.
   */
  multiSortMode?: 'accumulate' | 'modifier'
  /** Barra con el orden aplicado y su numeración. Por defecto, visible si hay orden. */
  showSortSummary?: boolean
  enableGlobalSearch?: boolean
  enableRowSelection?: boolean
  enableDensityToggle?: boolean
  enableVirtualization?: boolean
  enableExport?: boolean
  enablePagination?: boolean
  stripedRows?: boolean
  stickyHeader?: boolean

  virtualizationThreshold?: number
  overscan?: number
  pageSizeOptions?: number[]

  /* selección */
  selectedRowIds?: string[]
  onSelectionChange?: (ids: string[], rows: T[]) => void

  /* interacción */
  onRowClick?: (row: T, index: number, event: React.MouseEvent) => void
  onRowDoubleClick?: (row: T, index: number, event: React.MouseEvent) => void
  rowClassName?: (row: T, index: number) => string | undefined
  renderRowActions?: (row: T, index: number) => ReactNode
  renderExpanded?: (row: T, index: number) => ReactNode

  /* presentación */
  theme?: ThemeTokens
  classNames?: TableClassNames
  slots?: TableSlots<T>
  className?: string
  style?: CSSProperties
  height?: number | string
  labels?: Partial<TableLabels>

  /* export */
  exportFileName?: string
  pdfTitle?: string
  pdfOrientation?: 'portrait' | 'landscape'
}

export interface TableLabels {
  search: string
  columns: string
  density: string
  densityCompact: string
  densityNormal: string
  densityComfortable: string
  export: string
  exportCsvPage: string
  exportCsvAll: string
  exportPdfPage: string
  exportPdfAll: string
  reset: string
  empty: string
  loading: string
  errorRetry: string
  rowsPerPage: string
  of: string
  selected: string
  showAll: string
  hideAll: string
  pinLeft: string
  pinRight: string
  unpin: string
  sortAsc: string
  sortDesc: string
  clearSort: string
  sortOnly: string
  sortOrder: string
  clearAllSorts: string
  sortHint: string
  filterAll: string
  page: string
  first: string
  prev: string
  next: string
  last: string
  selectAll: string
  selectRow: string
  dragHint: string
}
