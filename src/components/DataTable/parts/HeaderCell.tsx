import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import s from '../DataTable.module.css'
import { DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH } from '../constants'
import { useTableConfig } from '../context'
import { widthVarOf } from '../layout'
import type { LayoutCol } from '../layout'
import { useSortEntry, useTableDispatch, useTableSelector } from '../store'
import { clamp, cx } from '../utils'
import { Popover } from './Popover'
import {
  IconArrowDown,
  IconArrowUp,
  IconEye,
  IconMore,
  IconPin,
  IconSortNeutral,
  IconX,
} from '../icons'

interface Props<T> {
  item: LayoutCol<T>
}

function HeaderCellInner<T>({ item }: Props<T>) {
  const column = item.column!
  const config = useTableConfig<T>()
  const dispatch = useTableDispatch()
  const { labels, flags, multiSortMode, rootRef } = config

  const { dir: sortDir, index: sortIndex, count: sortCount } = useSortEntry(column.id)
  const isDragging = useTableSelector((state) => state.ui.dragId === column.id)
  const dropSide = useTableSelector((state) =>
    state.ui.dropTarget?.id === column.id ? state.ui.dropTarget.side : null,
  )

  const canSort = column.sortable !== false
  const canResize = flags.enableColumnResize && column.resizable !== false
  const canReorder = flags.enableColumnReorder && column.reorderable !== false
  const canPin = flags.enableColumnPinning
  const canHide = flags.enableColumnVisibility && column.hideable !== false
  const hasMenu = canPin || canHide || canSort
  const align = column.align ?? 'left'

  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /* ---------------- sort ---------------- */

  const keepsOthers = (modifier: boolean) =>
    flags.enableMultiSort && (multiSortMode === 'accumulate' ? !modifier : modifier)

  const handleLabelClick = (e: MouseEvent) => {
    if (!canSort) return
    dispatch({
      type: 'sort/toggle',
      id: column.id,
      keepOthers: keepsOthers(e.shiftKey || e.metaKey || e.ctrlKey),
    })
  }

  /* ---------------- resize: CSS var en vivo, commit al soltar -------- */

  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number; width: number } | null>(null)

  const onResizeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const varName = widthVarOf(column.id)
    const current = rootRef.current
      ? parseFloat(getComputedStyle(rootRef.current).getPropertyValue(varName))
      : NaN
    const startWidth = Number.isFinite(current) ? current : (column.width ?? DEFAULT_WIDTH)
    resizeRef.current = { startX: e.clientX, startWidth, width: startWidth }
    setResizing(true)
  }

  useEffect(() => {
    if (!resizing) return
    const varName = widthVarOf(column.id)
    const min = column.minWidth ?? MIN_WIDTH
    const max = column.maxWidth ?? MAX_WIDTH

    // Durante el arrastre no hay ni un render: solo se escribe la variable
    // y el navegador recoloca colgroup + sticky por su cuenta.
    const onMove = (e: PointerEvent) => {
      const ref = resizeRef.current
      if (!ref) return
      ref.width = clamp(ref.startWidth + (e.clientX - ref.startX), min, max)
      rootRef.current?.style.setProperty(varName, `${ref.width}px`)
    }
    const stop = () => {
      const ref = resizeRef.current
      resizeRef.current = null
      setResizing(false)
      // Un único commit → un render, con el mismo valor que ya pinta el CSS.
      if (ref) dispatch({ type: 'columns/resize', id: column.id, width: ref.width })
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', stop)
    document.addEventListener('pointercancel', stop)
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', stop)
      document.removeEventListener('pointercancel', stop)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [resizing, column.id, column.minWidth, column.maxWidth, dispatch, rootRef])

  const onResizeReset = () => {
    const width = column.width ?? DEFAULT_WIDTH
    rootRef.current?.style.setProperty(widthVarOf(column.id), `${width}px`)
    dispatch({ type: 'columns/resize', id: column.id, width })
  }

  /* ---------------- drag & drop ---------------- */

  const onDragStart = (e: DragEvent<HTMLTableCellElement>) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', column.id)
    dispatch({ type: 'drag/start', id: column.id })
  }

  const onDragOver = (e: DragEvent<HTMLTableCellElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    dispatch({ type: 'drag/over', target: { id: column.id, side } })
  }

  const onDrop = (e: DragEvent<HTMLTableCellElement>) => {
    e.preventDefault()
    const from = e.dataTransfer.getData('text/plain')
    if (from && from !== column.id) {
      dispatch({ type: 'columns/reorder', fromId: from, toId: column.id, side: dropSide ?? 'before' })
    }
    dispatch({ type: 'drag/end' })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTableCellElement>) => {
    if (canReorder && (e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      dispatch({ type: 'columns/move', id: column.id, delta: e.key === 'ArrowLeft' ? -1 : 1 })
    }
  }

  /* ---------------- render ---------------- */

  const ariaSort = sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
  const pinSide = item.pin

  return (
    <th
      scope="col"
      className={cx(
        s.headerCell,
        pinSide && s.pinned,
        item.isPinEdge && (pinSide === 'left' ? s.pinLeftEdge : s.pinRightEdge),
        config.classNames?.headerCell,
      )}
      style={item.stickyStyle}
      aria-sort={canSort ? ariaSort : undefined}
      data-column-id={column.id}
      data-dragging={isDragging}
      data-drop={dropSide ?? undefined}
      draggable={canReorder && !resizing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={() => dispatch({ type: 'drag/end' })}
      onKeyDown={onKeyDown}
      tabIndex={canReorder ? 0 : undefined}
      title={column.headerTooltip}
    >
      <div className={s.headerInner} data-align={align}>
        {column.renderHeader ? (
          column.renderHeader({ column, sortIndex, sortDir })
        ) : (
          <button
            type="button"
            className={s.headerLabel}
            data-sortable={canSort}
            onClick={handleLabelClick}
            disabled={!canSort}
            aria-label={
              canSort
                ? `${typeof column.header === 'string' ? column.header : column.id}. ${
                    sortDir
                      ? `${labels.sortOrder} ${sortIndex} de ${sortCount}, ${sortDir === 'asc' ? 'ascendente' : 'descendente'}. `
                      : ''
                  }${labels.sortHint}`
                : undefined
            }
          >
            <span className={s.title}>{column.header}</span>
            {column.subHeader != null && <span className={s.subtitle}>{column.subHeader}</span>}
          </button>
        )}

        {canSort && (
          <span className={s.sortIndicator} data-active={Boolean(sortDir)}>
            {config.slots?.sortIndicator ? (
              config.slots.sortIndicator(sortDir, sortIndex)
            ) : (
              <>
                {sortDir === 'asc' && <IconArrowUp width={13} height={13} />}
                {sortDir === 'desc' && <IconArrowDown width={13} height={13} />}
                {!sortDir && <IconSortNeutral width={13} height={13} />}
                {/* La numeración es la posición en el ORDER BY. */}
                {sortDir && <span className={s.sortSeq}>{sortIndex}</span>}
              </>
            )}
          </span>
        )}

        {hasMenu && (
          <>
            <button
              ref={menuBtnRef}
              type="button"
              className={s.headerMenuBtn}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={`Opciones de ${column.id}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <IconMore width={14} height={14} />
            </button>
            <Popover anchorRef={menuBtnRef} open={menuOpen} onClose={closeMenu} align="end">
              {canSort && (
                <>
                  <button
                    type="button"
                    className={s.popItem}
                    role="menuitem"
                    onClick={() => {
                      dispatch({ type: 'sort/set', id: column.id, dir: 'asc', keepOthers: true })
                      closeMenu()
                    }}
                  >
                    <IconArrowUp /> {labels.sortAsc}
                  </button>
                  <button
                    type="button"
                    className={s.popItem}
                    role="menuitem"
                    onClick={() => {
                      dispatch({ type: 'sort/set', id: column.id, dir: 'desc', keepOthers: true })
                      closeMenu()
                    }}
                  >
                    <IconArrowDown /> {labels.sortDesc}
                  </button>
                  <button
                    type="button"
                    className={s.popItem}
                    role="menuitem"
                    disabled={sortCount <= 1 && Boolean(sortDir)}
                    onClick={() => {
                      dispatch({
                        type: 'sort/set',
                        id: column.id,
                        dir: sortDir ?? 'asc',
                        keepOthers: false,
                      })
                      closeMenu()
                    }}
                  >
                    <IconSortNeutral /> {labels.sortOnly}
                  </button>
                  <button
                    type="button"
                    className={s.popItem}
                    role="menuitem"
                    disabled={!sortDir}
                    onClick={() => {
                      dispatch({ type: 'sort/set', id: column.id, dir: null, keepOthers: true })
                      closeMenu()
                    }}
                  >
                    <IconX /> {labels.clearSort}
                  </button>
                  {(canPin || canHide) && <div className={s.popSep} />}
                </>
              )}
              {canPin && (
                <>
                  <button
                    type="button"
                    className={s.popItem}
                    role="menuitem"
                    onClick={() => {
                      dispatch({
                        type: 'columns/pin',
                        id: column.id,
                        side: pinSide === 'left' ? null : 'left',
                      })
                      closeMenu()
                    }}
                  >
                    <IconPin style={{ transform: 'rotate(-45deg)' }} />
                    {pinSide === 'left' ? labels.unpin : labels.pinLeft}
                  </button>
                  <button
                    type="button"
                    className={s.popItem}
                    role="menuitem"
                    onClick={() => {
                      dispatch({
                        type: 'columns/pin',
                        id: column.id,
                        side: pinSide === 'right' ? null : 'right',
                      })
                      closeMenu()
                    }}
                  >
                    <IconPin style={{ transform: 'rotate(45deg)' }} />
                    {pinSide === 'right' ? labels.unpin : labels.pinRight}
                  </button>
                </>
              )}
              {canHide && (
                <button
                  type="button"
                  className={s.popItem}
                  role="menuitem"
                  onClick={() => {
                    dispatch({ type: 'columns/toggle', id: column.id })
                    closeMenu()
                  }}
                >
                  <IconEye /> Ocultar columna
                </button>
              )}
            </Popover>
          </>
        )}
      </div>

      {canResize && (
        <div
          className={s.resizer}
          data-resizing={resizing}
          onPointerDown={onResizeStart}
          onDoubleClick={onResizeReset}
          onDragStart={(e) => e.preventDefault()}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Redimensionar ${column.id}`}
        />
      )}
    </th>
  )
}

/** memo: solo re-renderiza si cambia su item del layout (o sus selectores). */
export const HeaderCell = memo(HeaderCellInner) as typeof HeaderCellInner
