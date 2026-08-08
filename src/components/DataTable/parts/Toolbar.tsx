import { memo, useCallback, useRef, useState } from 'react'
import s from '../DataTable.module.css'
import { useTableConfig, useTableData } from '../context'
import { useTableDispatch, useTableSelector } from '../store'
import { isFilterActive } from '../utils'
import { Popover } from './Popover'
import {
  IconChevronDown,
  IconColumns,
  IconDensity,
  IconDownload,
  IconGrip,
  IconRotate,
  IconSearch,
  IconX,
} from '../icons'
import type { ColumnDef } from '../types'

function ToolbarInner() {
  const config = useTableConfig<unknown>()
  const data = useTableData<unknown>()
  const dispatch = useTableDispatch()
  const { labels, flags, columns, columnById } = config

  // Cada dato llega por selector: la toolbar solo se re-renderiza
  // cuando cambia algo que pinta.
  const globalSearch = useTableSelector((state) => state.committed.globalSearch)
  const density = useTableSelector((state) => state.committed.density)
  const order = useTableSelector((state) => state.committed.order)
  const hidden = useTableSelector((state) => state.committed.hidden)
  const sortCount = useTableSelector((state) => state.committed.sorts.length)
  const activeFilterCount = useTableSelector(
    (state) => state.committed.filters.filter(isFilterActive).length,
  )
  const selectedCount = useTableSelector((state) => state.ui.selection.size)

  const [columnsOpen, setColumnsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const columnsBtnRef = useRef<HTMLButtonElement>(null)
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const closeColumns = useCallback(() => setColumnsOpen(false), [])
  const closeExport = useCallback(() => setExportOpen(false), [])

  const hiddenSet = new Set(hidden)
  const ordered = order
    .map((id) => columnById.get(id))
    .filter((c): c is ColumnDef<unknown> => Boolean(c))
  const hiddenCount = ordered.filter((c) => hiddenSet.has(c.id)).length
  const dirty = activeFilterCount > 0 || sortCount > 0 || hiddenCount > 0 || Boolean(globalSearch)

  return (
    <div className={`${s.toolbar} ${config.classNames?.toolbar ?? ''}`}>
      {flags.enableGlobalSearch && (
        <div className={s.searchBox}>
          <IconSearch />
          <input
            type="text"
            value={globalSearch}
            placeholder={labels.search}
            onChange={(e) => dispatch({ type: 'search/set', value: e.target.value })}
            aria-label={labels.search}
          />
          {globalSearch && (
            <button
              type="button"
              className={s.clear}
              onClick={() => dispatch({ type: 'search/set', value: '' })}
              aria-label="Limpiar búsqueda"
            >
              <IconX width={11} height={11} />
            </button>
          )}
        </div>
      )}

      <div className={s.spacer} />

      {selectedCount > 0 && (
        <span className={s.selectionInfo}>
          {selectedCount} {labels.selected}
        </span>
      )}

      {activeFilterCount > 0 && (
        <span className={s.badge} title={`${activeFilterCount} filtros activos`}>
          {activeFilterCount}
        </span>
      )}

      {flags.enableDensityToggle && (
        <div className={s.segmented} role="group" aria-label={labels.density}>
          <IconDensity style={{ alignSelf: 'center', margin: '0 4px', opacity: 0.5 }} />
          {(
            [
              ['compact', labels.densityCompact],
              ['normal', labels.densityNormal],
              ['comfortable', labels.densityComfortable],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-active={density === key}
              onClick={() => dispatch({ type: 'density/set', density: key })}
              aria-pressed={density === key}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {flags.enableColumnVisibility && (
        <>
          <button
            ref={columnsBtnRef}
            type="button"
            className={s.btn}
            data-active={hiddenCount > 0}
            onClick={() => setColumnsOpen((o) => !o)}
            aria-expanded={columnsOpen}
            aria-haspopup="menu"
          >
            <IconColumns /> {labels.columns}
            {hiddenCount > 0 && <span className={s.badge}>{hiddenCount}</span>}
            <IconChevronDown width={12} height={12} />
          </button>
          <Popover
            anchorRef={columnsBtnRef}
            open={columnsOpen}
            onClose={closeColumns}
            role="group"
            minWidth={260}
          >
            <div className={s.popHeader}>
              <span style={{ flex: 1 }}>{labels.dragHint}</span>
            </div>
            {ordered.map((column) => (
              <div
                key={column.id}
                draggable={column.reorderable !== false}
                onDragStart={() => setDragId(column.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId && dragId !== column.id) {
                    dispatch({
                      type: 'columns/reorder',
                      fromId: dragId,
                      toId: column.id,
                      side: 'before',
                    })
                  }
                  setDragId(null)
                }}
                onDragEnd={() => setDragId(null)}
                style={{ opacity: dragId === column.id ? 0.4 : 1 }}
              >
                <label className={s.popItem} style={{ cursor: 'pointer' }}>
                  <IconGrip className={s.grip} />
                  <input
                    className={s.checkbox}
                    type="checkbox"
                    checked={!hiddenSet.has(column.id)}
                    disabled={column.hideable === false}
                    onChange={() => dispatch({ type: 'columns/toggle', id: column.id })}
                  />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {typeof column.header === 'string' ? column.header : column.id}
                  </span>
                  <button
                    type="button"
                    className={s.iconBtn}
                    style={{ width: 20, height: 20 }}
                    onClick={(e) => {
                      e.preventDefault()
                      dispatch({ type: 'columns/move', id: column.id, delta: -1 })
                    }}
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={s.iconBtn}
                    style={{ width: 20, height: 20 }}
                    onClick={(e) => {
                      e.preventDefault()
                      dispatch({ type: 'columns/move', id: column.id, delta: 1 })
                    }}
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                </label>
              </div>
            ))}
            <div className={s.popSep} />
            <button
              type="button"
              className={s.popItem}
              onClick={() => dispatch({ type: 'columns/setHidden', hidden: [] })}
            >
              {labels.showAll}
            </button>
            <button
              type="button"
              className={s.popItem}
              onClick={() =>
                dispatch({
                  type: 'columns/setHidden',
                  hidden: columns.filter((c) => c.hideable !== false).map((c) => c.id),
                })
              }
            >
              {labels.hideAll}
            </button>
          </Popover>
        </>
      )}

      {flags.enableExport && (
        <>
          <button
            ref={exportBtnRef}
            type="button"
            className={s.btn}
            onClick={() => setExportOpen((o) => !o)}
            aria-expanded={exportOpen}
            aria-haspopup="menu"
            disabled={data.exporting}
          >
            <IconDownload /> {labels.export}
            <IconChevronDown width={12} height={12} />
          </button>
          <Popover anchorRef={exportBtnRef} open={exportOpen} onClose={closeExport}>
            {(
              [
                ['csv', 'page', labels.exportCsvPage],
                ['csv', 'all', labels.exportCsvAll],
                ['pdf', 'page', labels.exportPdfPage],
                ['pdf', 'all', labels.exportPdfAll],
              ] as const
            ).map(([format, scope, label]) => (
              <button
                key={`${format}-${scope}`}
                type="button"
                className={s.popItem}
                role="menuitem"
                onClick={() => {
                  data.onExport(format, scope)
                  closeExport()
                }}
              >
                {label}
              </button>
            ))}
          </Popover>
        </>
      )}

      <button type="button" className={s.btn} onClick={data.reset} disabled={!dirty} title={labels.reset}>
        <IconRotate /> {labels.reset}
      </button>
    </div>
  )
}

export const Toolbar = memo(ToolbarInner)
