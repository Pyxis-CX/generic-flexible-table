'use client'

import { memo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import s from '../DataTable.module.css'
import { useTableConfig } from '../context'
import { IconChevronRight } from '../icons'
import type { LayoutCol } from '../layout'
import { useIsExpanded, useIsSelected, useTableDispatch } from '../store'
import { cx, getCellValue, toPlainText } from '../utils'

export interface BodyRowProps<T> {
  row: T
  rowId: string
  absoluteIndex: number
  layout: LayoutCol<T>[]
}

/**
 * Una fila = un suscriptor. Solo re-renderiza si:
 *  - cambia su `row`/`layout` (identidad, via memo), o
 *  - cambia SU selección/expansión (selector booleano por rowId).
 *  - cambia su `row`/`layout` (identidad, via memo), o
 *
 * Marcar un checkbox toca 1 fila; las otras 49 ni se enteran.
 */
function BodyRowInner<T>({ row, rowId, absoluteIndex, layout }: BodyRowProps<T>) {
  const config = useTableConfig<T>()
  const dispatch = useTableDispatch()
  const isSelected = useIsSelected(rowId)
  const isExpanded = useIsExpanded(rowId)

  const {
    classNames,
    labels,
    onRowClick,
    onRowDoubleClick,
    rowClassName,
    renderRowActions,
    renderExpanded,
  } = config

  const renderCell = (item: LayoutCol<T>) => {
    const baseClass = cx(
      item.pin && s.pinned,
      item.isPinEdge && (item.pin === 'left' ? s.pinLeftEdge : s.pinRightEdge),
      classNames?.cell,
    )

    switch (item.kind) {
      case 'select':
        return (
          <td key={item.key} tabIndex={-1} className={baseClass} style={item.stickyStyle}>
            <div className={s.cellInner} data-align="center">
              <input
                className={s.checkbox}
                type="checkbox"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => dispatch({ type: 'selection/toggleRow', id: rowId })}
                aria-label={labels.selectRow}
              />
            </div>
          </td>
        )
      case 'expander':
        return (
          <td key={item.key} tabIndex={-1} className={baseClass} style={item.stickyStyle}>
            <div className={s.cellInner} data-align="center">
              <button
                type="button"
                className={s.iconBtn}
                style={{ width: 24, height: 24 }}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'expanded/toggle', id: rowId })
                }}
                aria-expanded={isExpanded}
                aria-label="Expandir fila"
              >
                <IconChevronRight
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : undefined,
                    transition: 'transform var(--dt-transition)',
                  }}
                />
              </button>
            </div>
          </td>
        )
      case 'actions':
        return (
          <td key={item.key} tabIndex={-1} className={baseClass} style={item.stickyStyle}>
            <div className={s.cellInner} data-align="right">
              {renderRowActions?.(row, absoluteIndex)}
            </div>
          </td>
        )
      case 'filler':
        return <td key={item.key} aria-hidden />
      case 'hspacer':
        return <td key={item.key} aria-hidden style={{ padding: 0, border: 0 }} />
      default: {
        const column = item.column!
        const value = getCellValue(row, column)
        const ctx = { value, row, rowIndex: absoluteIndex, column }
        const extraClass =
          typeof column.cellClassName === 'function'
            ? column.cellClassName(ctx)
            : column.cellClassName
        const extraStyle: CSSProperties | undefined =
          typeof column.cellStyle === 'function' ? column.cellStyle(ctx) : column.cellStyle
        return (
          <td
            key={item.key}
            tabIndex={-1}
            className={cx(baseClass, extraClass)}
            style={extraStyle ? { ...item.stickyStyle, ...extraStyle } : item.stickyStyle}
          >
            <div className={s.cellInner} data-align={column.align ?? 'left'}>
              {column.renderCell ? column.renderCell(ctx) : toPlainText(value, row, column)}
            </div>
          </td>
        )
      }
    }
  }

  return (
    <>
      <tr
        data-row="1"
        aria-rowindex={absoluteIndex + 2}
        data-stripe={absoluteIndex % 2 === 1 ? 'odd' : 'even'}
        data-selected={isSelected}
        data-clickable={Boolean(onRowClick)}
        className={cx(s.row, classNames?.row, rowClassName?.(row, absoluteIndex))}
        onClick={onRowClick ? (e) => onRowClick(row, absoluteIndex, e) : undefined}
        onDoubleClick={onRowDoubleClick ? (e) => onRowDoubleClick(row, absoluteIndex, e) : undefined}
        aria-selected={config.flags.enableRowSelection ? isSelected : undefined}
      >
        {layout.map(renderCell)}
      </tr>
      {renderExpanded && isExpanded && (
        <tr>
          <td className={s.expandedCell} colSpan={layout.length}>
            {renderExpanded(row, absoluteIndex)}
          </td>
        </tr>
      )}
    </>
  )
}

type BodyRowComponent = <T>(props: BodyRowProps<T>) => ReactNode
export const BodyRow: BodyRowComponent = memo(BodyRowInner) as BodyRowComponent
