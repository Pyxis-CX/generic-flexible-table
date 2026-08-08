'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, ReactNode } from 'react'

import s from './DataTable.module.css'

import { DEFAULT_WIDTH, DENSITY_ROW_HEIGHT, FILTER_DEBOUNCE } from './constants'
import { ConfigContext, DataContext } from './context'
import type { TableConfig, TableData, TableFlags } from './context'
import { fetchAllPaginated } from './dataSources'
import { exportToCsv, exportToPdf } from './exporters'
import {
  clearPersisted,
  readPersisted,
  useDataSource,
  useDebouncedValue,
  useVirtualRows,
  writePersisted,
} from './hooks'
import { IconAlert, IconInbox, IconRotate } from './icons'
import { buildLayout, tableMinWidthExpr, widthVarOf } from './layout'
import { BodyRow } from './parts/BodyRow'
import { Footer } from './parts/Footer'
import { HeaderCell } from './parts/HeaderCell'
import { FilterCell, StructuralHeaderCell } from './parts/HeaderStructural'
import { SortBar } from './parts/SortBar'
import { Toolbar } from './parts/Toolbar'
import { PortalContext } from './portalContext'
import { buildTableState, reconcileOrder } from './state'
import { StoreContext, createTableStore } from './store'
import {
  DEFAULT_LABELS,
  createSearchIndex,
  cx,
  deriveFacets,
  filterRows,
  sortRows,
  themeToCssVars,
} from './utils'
import type {
  ColumnDef,
  DataTableProps,
  ExportScope,
  QueryState,
  SelectOption,
  TableState,
} from './types'

const EMPTY_ROWS: never[] = []

/** Lotes del export "todos" en modo server: siempre paginado, nunca un fetch total. */
const EXPORT_CHUNK = 500
const EXPORT_MAX_ROWS = 50_000

export function DataTable<T>(props: DataTableProps<T>): ReactNode {
  const {
    columns,
    rows = EMPTY_ROWS,
    dataSource,
    dataSourceKey,
    getRowId,
    tableId,
    persist = true,
    persistVersion = 1,
    initialState,
    onStateChange,

    enableColumnReorder = true,
    enableColumnResize = true,
    enableColumnPinning = true,
    enableColumnVisibility = true,
    enableMultiSort = true,
    multiSortMode = 'accumulate',
    showSortSummary = true,
    enableGlobalSearch = true,
    enableRowSelection = false,
    enableDensityToggle = true,
    enableVirtualization = false,
    enableExport = true,
    enablePagination = true,
    stripedRows = false,
    stickyHeader = true,

    virtualizationThreshold = 80,
    overscan = 8,
    pageSizeOptions = [10, 25, 50, 100],

    selectedRowIds,
    onSelectionChange,
    onRowClick,
    onRowDoubleClick,
    rowClassName,
    renderRowActions,
    renderExpanded,

    theme,
    classNames,
    slots,
    className,
    style,
    height,
    labels: labelOverrides,

    exportFileName = 'tabla',
    pdfTitle,
    pdfOrientation = 'landscape',
  } = props

  /* ---------------- labels ---------------- */

  const labels = useMemo(() => {
    const base = { ...DEFAULT_LABELS, ...labelOverrides }
    if (labelOverrides?.sortHint) return base
    if (!enableMultiSort) return { ...base, sortHint: 'Clic para ordenar.' }
    if (multiSortMode === 'modifier') {
      return {
        ...base,
        sortHint:
          'Clic para ordenar solo por esta columna. Shift + clic para añadir al orden múltiple.',
      }
    }
    return base
  }, [labelOverrides, enableMultiSort, multiSortMode])

  const storageKey = persist && tableId ? `dt:${tableId}` : null

  /* ---------------- store ---------------- */

  const buildInitial = useCallback((): TableState => {
    const base = buildTableState(columns, initialState)
    const saved = readPersisted<Partial<TableState>>(storageKey, persistVersion)
    if (!saved) return base
    return {
      ...base,
      ...saved,
      order: reconcileOrder(saved.order ?? base.order, columns.map((c) => c.id)),
      widths: { ...base.widths, ...saved.widths },
      pins: { ...base.pins, ...saved.pins },
      page: 1,
      globalSearch: '',
    }
    // Solo para el primer render y para reset explícito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [store] = useState(() => createTableStore(buildInitial()))

  // El orquestador solo se suscribe al estado CONFIRMADO: lo interactivo
  // (selección, drag, hover) no lo re-renderiza.
  const committed = useSyncExternalStore(
    store.subscribe,
    () => store.getState().committed,
    () => store.getState().committed,
  )
  const expandedCount = useSyncExternalStore(
    store.subscribe,
    () => store.getState().ui.expanded.size,
    () => store.getState().ui.expanded.size,
  )

  /* ---------------- efectos de sincronización ---------------- */

  const columnIdsKey = columns.map((c) => c.id).join('|')
  useEffect(() => {
    store.dispatch({
      type: 'columns/reconcile',
      ids: columnIdsKey.split('|').filter(Boolean),
      widths: Object.fromEntries(columns.map((c) => [c.id, c.width ?? DEFAULT_WIDTH])),
      pins: Object.fromEntries(columns.map((c) => [c.id, c.pin ?? null])),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnIdsKey, store])

  useEffect(() => {
    if (!storageKey) return
    const { page: _page, globalSearch: _q, ...persisted } = committed
    writePersisted(storageKey, persistVersion, persisted)
  }, [committed, storageKey, persistVersion])

  useEffect(() => {
    onStateChange?.(committed)
  }, [committed, onStateChange])

  // Selección controlada: prop → store (con guarda anti-eco).
  useEffect(() => {
    if (!selectedRowIds) return
    const current = store.getState().ui.selection
    if (selectedRowIds.length === current.size && selectedRowIds.every((id) => current.has(id))) {
      return
    }
    store.dispatch({ type: 'selection/set', ids: selectedRowIds })
  }, [selectedRowIds, store])

  /* ---------------- pipeline de datos ---------------- */

  const isClient = !dataSource
  const debouncedSearch = useDebouncedValue(committed.globalSearch, FILTER_DEBOUNCE)

  // Capa 0 — índice de búsqueda: se construye perezosamente y UNA vez por dataset.
  const searchIndex = useMemo(
    () => (isClient && rows.length ? createSearchIndex(rows, columns) : null),
    [isClient, rows, columns],
  )

  // Capa 1 — filtrar: solo cuando cambian filtros/búsqueda/datos.
  const filtered = useMemo(
    () =>
      isClient
        ? filterRows(rows, committed.filters, debouncedSearch, columns, searchIndex ?? undefined)
        : EMPTY_ROWS,
    [isClient, rows, committed.filters, debouncedSearch, columns, searchIndex],
  )

  // Capa 2 — ordenar: NO se repite al filtrar-igual ni al paginar.
  const sorted = useMemo(
    () => (isClient ? sortRows(filtered, committed.sorts, columns) : EMPTY_ROWS),
    [isClient, filtered, committed.sorts, columns],
  )

  // Modo server: la tabla emite el QueryState y espera { rows, total }.
  const serverQuery = useMemo<QueryState>(
    () => ({
      page: committed.page,
      pageSize: committed.pageSize,
      sorts: committed.sorts,
      filters: committed.filters,
      globalSearch: debouncedSearch,
    }),
    [committed.page, committed.pageSize, committed.sorts, committed.filters, debouncedSearch],
  )
  const server = useDataSource(dataSource ?? null, serverQuery, String(dataSourceKey ?? ''))

  const total = isClient ? sorted.length : server.total
  const pageCount = enablePagination
    ? Math.max(1, Math.ceil(total / Math.max(1, committed.pageSize)))
    : 1

  // Capa 3 — paginar: un slice. Cambiar de página cuesta O(pageSize).
  const pageRows = useMemo(() => {
    if (!isClient) return server.rows
    if (!enablePagination) return sorted
    const start = (committed.page - 1) * committed.pageSize
    return sorted.slice(start, start + committed.pageSize)
  }, [isClient, server.rows, sorted, committed.page, committed.pageSize, enablePagination])

  const pageRowIds = useMemo(
    () => pageRows.map((row, i) => getRowId(row, i)),
    [pageRows, getRowId],
  )

  // Página fuera de rango tras filtrar → última válida.
  useEffect(() => {
    if (enablePagination && committed.page > pageCount) {
      store.dispatch({ type: 'page/set', page: pageCount })
    }
  }, [committed.page, pageCount, enablePagination, store])

  // Selección → callback externo (sin eco en el montaje).
  const selectionSyncRef = useRef({ first: true, pageRows, getRowId })
  selectionSyncRef.current.pageRows = pageRows
  selectionSyncRef.current.getRowId = getRowId
  useEffect(() => {
    if (!onSelectionChange) return
    return store.subscribe(() => {
      const sync = selectionSyncRef.current
      const selection = store.getState().ui.selection
      if (sync.first) {
        sync.first = false
        return
      }
      const ids = [...selection]
      onSelectionChange(
        ids,
        sync.pageRows.filter((row, i) => selection.has(sync.getRowId(row, i))),
      )
    })
  }, [store, onSelectionChange])

  /* ---------------- facets ---------------- */

  const clientFacets = useMemo(() => {
    const map = new Map<string, SelectOption[]>()
    if (!isClient) return map
    for (const column of columns) {
      if (column.filter?.kind === 'select' && !column.filter.options) {
        map.set(column.id, deriveFacets(rows, column))
      }
    }
    return map
  }, [isClient, rows, columns])

  const facets = useCallback(
    (columnId: string): SelectOption[] =>
      dataSource ? (dataSource.getFacets?.(columnId) ?? []) : (clientFacets.get(columnId) ?? []),
    [dataSource, clientFacets],
  )

  /* ---------------- export ---------------- */

  const [exporting, setExporting] = useState(false)
  const exportDepsRef = useRef({ pageRows, sorted, total, committed })
  exportDepsRef.current = { pageRows, sorted, total, committed }

  const handleExport = useCallback(
    async (format: 'csv' | 'pdf', scope: ExportScope) => {
      setExporting(true)
      try {
        const deps = exportDepsRef.current
        let data = deps.pageRows
        if (scope === 'all') {
          data = dataSource
            ? // Nunca traer todo de golpe: lotes paginados con tope de seguridad.
              await fetchAllPaginated(
                dataSource,
                {
                  sorts: deps.committed.sorts,
                  filters: deps.committed.filters,
                  globalSearch: deps.committed.globalSearch,
                },
                { chunkSize: EXPORT_CHUNK, maxRows: EXPORT_MAX_ROWS },
              )
            : deps.sorted // ya está en memoria: no hay fetch que paginar
        }
        const visibleIds = new Set(
          deps.committed.order.filter((id) => !deps.committed.hidden.includes(id)),
        )
        const exportColumns = columns.filter(
          (c) => visibleIds.has(c.id) && c.exportable !== false,
        )
        const fileName = `${exportFileName}-${scope}`
        if (format === 'csv') {
          exportToCsv({ rows: data, columns: exportColumns, fileName })
        } else {
          await exportToPdf(
            { rows: data, columns: exportColumns, fileName },
            {
              title: pdfTitle ?? exportFileName,
              subtitle: `${data.length} ${labels.of} ${deps.total} registros`,
              orientation: pdfOrientation,
            },
          )
        }
      } finally {
        setExporting(false)
      }
    },
    [dataSource, columns, exportFileName, pdfTitle, pdfOrientation, labels.of],
  )

  const reset = useCallback(() => {
    clearPersisted(storageKey)
    store.dispatch({ type: 'reset', state: buildTableState(columns, initialState) })
  }, [storageKey, store, columns, initialState])

  /* ---------------- layout (estable durante el resize) ---------------- */

  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const hiddenSet = useMemo(() => new Set(committed.hidden), [committed.hidden])

  const visibleColumns = useMemo(
    () =>
      committed.order
        .map((id) => columnById.get(id))
        .filter((c): c is ColumnDef<T> => Boolean(c) && !hiddenSet.has(c!.id)),
    [committed.order, columnById, hiddenSet],
  )

  const layout = useMemo(
    () =>
      buildLayout({
        visibleColumns,
        pins: committed.pins,
        pinningEnabled: enableColumnPinning,
        hasSelection: enableRowSelection,
        hasExpander: Boolean(renderExpanded),
        hasActions: Boolean(renderRowActions),
      }),
    [
      visibleColumns,
      committed.pins,
      enableColumnPinning,
      enableRowSelection,
      renderExpanded,
      renderRowActions,
    ],
  )

  const minWidth = useMemo(() => tableMinWidthExpr(layout), [layout])
  const hasFilterRow = visibleColumns.some((c) => c.filter && c.filter.kind !== 'none')

  // Anchos → CSS vars en el raíz. El resize en vivo escribe estas mismas
  // variables a mano; el commit final pasa por aquí con el valor idéntico.
  const widthVars = useMemo(() => {
    const vars: Record<string, string> = {}
    for (const column of columns) {
      vars[widthVarOf(column.id)] =
        `${committed.widths[column.id] ?? column.width ?? DEFAULT_WIDTH}px`
    }
    return vars
  }, [columns, committed.widths])

  /* ---------------- virtualización ---------------- */

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)
  const [rowHeight, setRowHeight] = useState(DENSITY_ROW_HEIGHT[committed.density])

  useLayoutEffect(() => {
    const first = tbodyRef.current?.querySelector<HTMLTableRowElement>('tr[data-row="1"]')
    const measured = first?.getBoundingClientRect().height
    if (measured && Math.abs(measured - rowHeight) > 0.5) setRowHeight(measured)
  }, [committed.density, theme, pageRows.length, rowHeight])

  const virtualEnabled =
    enableVirtualization && expandedCount === 0 && pageRows.length >= virtualizationThreshold

  const range = useVirtualRows({
    enabled: virtualEnabled,
    count: pageRows.length,
    rowHeight,
    overscan,
    scrollRef: scrollerRef,
  })

  const visibleRows = virtualEnabled ? pageRows.slice(range.start, range.end) : pageRows

  /* ---------------- contextos ---------------- */

  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null)

  const flags = useMemo<TableFlags>(
    () => ({
      enableColumnReorder,
      enableColumnResize,
      enableColumnPinning,
      enableColumnVisibility,
      enableMultiSort,
      enableGlobalSearch,
      enableRowSelection,
      enableDensityToggle,
      enableExport,
      enablePagination,
      stickyHeader,
      stripedRows,
    }),
    [
      enableColumnReorder,
      enableColumnResize,
      enableColumnPinning,
      enableColumnVisibility,
      enableMultiSort,
      enableGlobalSearch,
      enableRowSelection,
      enableDensityToggle,
      enableExport,
      enablePagination,
      stickyHeader,
      stripedRows,
    ],
  )

  // Consumido por las FILAS: derivado solo de props. Memoiza tus render
  // props en el consumidor para que la identidad se conserve.
  const config = useMemo<TableConfig<T>>(
    () => ({
      columns,
      columnById,
      getRowId,
      labels,
      flags,
      multiSortMode,
      pageSizeOptions,
      classNames,
      slots,
      onRowClick,
      onRowDoubleClick,
      rowClassName,
      renderRowActions,
      renderExpanded,
      rootRef,
    }),
    [
      columns,
      columnById,
      getRowId,
      labels,
      flags,
      multiSortMode,
      pageSizeOptions,
      classNames,
      slots,
      onRowClick,
      onRowDoubleClick,
      rowClassName,
      renderRowActions,
      renderExpanded,
    ],
  )

  // Consumido por las piezas estructurales: cambia con cada resultado.
  const dataCtx = useMemo<TableData<T>>(
    () => ({
      pageRows,
      pageRowIds,
      total,
      pageCount,
      loading: server.loading,
      error: server.error,
      exporting,
      refetch: server.refetch,
      reset,
      onExport: handleExport,
      facets,
    }),
    [
      pageRows,
      pageRowIds,
      total,
      pageCount,
      server.loading,
      server.error,
      server.refetch,
      exporting,
      reset,
      handleExport,
      facets,
    ],
  )

  /* ---------------- estilos raíz ---------------- */

  const rootStyle: CSSProperties = {
    ...(height !== undefined ? { height } : undefined),
    ...widthVars,
    ...themeToCssVars(theme),
    ...style,
  }

  const scrollerStyle: CSSProperties | undefined =
    height === undefined ? { maxHeight: virtualEnabled ? 520 : '70vh' } : undefined

  const columnCount = layout.length
  const loading = server.loading
  const error = server.error

  /* ---------------- render ---------------- */

  return (
    <StoreContext.Provider value={store}>
      <ConfigContext.Provider value={config}>
        <DataContext.Provider value={dataCtx}>
          <div
            ref={rootRef}
            className={cx(s.root, stripedRows && s.striped, classNames?.root, className)}
            style={rootStyle}
            data-dt-density={committed.density}
          >
            {/* Hijo del root para heredar tokens; `fixed` para no ser recortado. */}
            <div ref={setPortalHost} className={s.portalHost} />
            <PortalContext.Provider value={portalHost}>
              <Toolbar />
              {showSortSummary && enableMultiSort && <SortBar />}

              <div
                ref={scrollerRef}
                className={cx(s.scroller, classNames?.scroller)}
                style={scrollerStyle}
              >
                {loading && (
                  <div className={s.loadingBar} role="progressbar" aria-label={labels.loading} />
                )}

                <table
                  className={cx(s.table, classNames?.table)}
                  style={{ width: '100%', minWidth }}
                  aria-rowcount={total}
                >
                  <colgroup>
                    {layout.map((item) => (
                      <col
                        key={item.key}
                        style={item.widthExpr ? { width: item.widthExpr } : undefined}
                      />
                    ))}
                  </colgroup>

                  <thead className={cx(s.thead, !stickyHeader && s.theadStatic, classNames?.thead)}>
                    <tr className={cx(s.headerRow, classNames?.headerRow)}>
                      {layout.map((item) =>
                        item.kind === 'data' ? (
                          <HeaderCell<T> key={item.key} item={item} />
                        ) : (
                          <StructuralHeaderCell<T> key={item.key} item={item} />
                        ),
                      )}
                    </tr>
                    {hasFilterRow && (
                      <tr className={cx(s.filterRow, classNames?.filterRow)}>
                        {layout.map((item) => (
                          <FilterCell<T> key={item.key} item={item} />
                        ))}
                      </tr>
                    )}
                  </thead>

                  <tbody ref={tbodyRef} className={cx(s.tbody, classNames?.tbody)}>
                    {virtualEnabled && range.padTop > 0 && (
                      <tr aria-hidden style={{ height: range.padTop }}>
                        <td
                          colSpan={columnCount}
                          style={{ padding: 0, border: 0, height: range.padTop }}
                        />
                      </tr>
                    )}

                    {error && (
                      <tr>
                        <td className={s.stateCell} colSpan={columnCount}>
                          {slots?.error ? (
                            slots.error(error, server.refetch)
                          ) : (
                            <div className={cx(s.stateBox, s.errorBox)} role="alert">
                              <IconAlert />
                              <strong>{error.message}</strong>
                              <button type="button" className={s.btn} onClick={server.refetch}>
                                <IconRotate /> {labels.errorRetry}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}

                    {!error && loading && pageRows.length === 0 && (
                      <tr>
                        <td className={s.stateCell} colSpan={columnCount}>
                          {slots?.loading ?? (
                            <div className={s.stateBox}>
                              <div className={s.spinner} />
                              {labels.loading}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}

                    {!error && !loading && pageRows.length === 0 && (
                      <tr>
                        <td className={s.stateCell} colSpan={columnCount}>
                          {typeof slots?.empty === 'function' ? (
                            slots.empty()
                          ) : (
                            (slots?.empty ?? (
                              <div className={s.stateBox}>
                                <IconInbox />
                                <strong>{labels.empty}</strong>
                              </div>
                            ))
                          )}
                        </td>
                      </tr>
                    )}

                    {visibleRows.map((row, i) => {
                      const absoluteIndex = (virtualEnabled ? range.start : 0) + i
                      return (
                        <BodyRow<T>
                          key={pageRowIds[absoluteIndex] ?? absoluteIndex}
                          row={row}
                          rowId={pageRowIds[absoluteIndex]}
                          absoluteIndex={absoluteIndex}
                          layout={layout}
                        />
                      )
                    })}

                    {virtualEnabled && range.padBottom > 0 && (
                      <tr aria-hidden style={{ height: range.padBottom }}>
                        <td
                          colSpan={columnCount}
                          style={{ padding: 0, border: 0, height: range.padBottom }}
                        />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {enablePagination &&
                (slots?.pagination ? (
                  slots.pagination({
                    page: committed.page,
                    pageSize: committed.pageSize,
                    total,
                    pageCount,
                    setPage: (page) => store.dispatch({ type: 'page/set', page }),
                    setPageSize: (size) => store.dispatch({ type: 'pageSize/set', size }),
                  })
                ) : (
                  <Footer />
                ))}
            </PortalContext.Provider>
          </div>
        </DataContext.Provider>
      </ConfigContext.Provider>
    </StoreContext.Provider>
  )
}
