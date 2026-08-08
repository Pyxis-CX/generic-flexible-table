'use client'

import { memo, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import s from '../DataTable.module.css'
import { FILTER_DEBOUNCE } from '../constants'
import { useTableConfig, useTableData } from '../context'
import type { LayoutCol } from '../layout'
import { useTableDispatch, useTableSelector } from '../store'
import { cx } from '../utils'
import { FilterControl } from './FilterControl'

/* ------------------------------------------------------------------ */
/* Celda estructural de cabecera (select-all / expander / actions)     */
/* ------------------------------------------------------------------ */

function StructuralHeaderCellInner<T>({ item }: { item: LayoutCol<T> }) {
  const { labels, classNames } = useTableConfig<T>()
  const { pageRowIds } = useTableData<T>()
  const dispatch = useTableDispatch()

  // Se suscribe al Set (identidad) y deriva en render: los selectores no
  // deben cerrar sobre datos de fuera del store (caché → valor rancio).
  const selection = useTableSelector((state) => state.ui.selection)
  const allSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selection.has(id))
  const someSelected = pageRowIds.some((id) => selection.has(id))

  const checkboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected && !allSelected
  }, [someSelected, allSelected])

  return (
    <th
      scope="col"
      className={cx(
        item.pin && s.pinned,
        item.isPinEdge && (item.pin === 'left' ? s.pinLeftEdge : s.pinRightEdge),
        classNames?.headerCell,
      )}
      style={item.stickyStyle}
    >
      {item.kind === 'select' && (
        <div className={s.headerInner} data-align="center">
          <input
            ref={checkboxRef}
            className={s.checkbox}
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              dispatch({ type: 'selection/setPage', ids: pageRowIds, select: !allSelected })
            }
            aria-label={labels.selectAll}
          />
        </div>
      )}
    </th>
  )
}

type StructuralHeaderCellComponent = <T>(props: { item: LayoutCol<T> }) => ReactNode
export const StructuralHeaderCell: StructuralHeaderCellComponent = memo(StructuralHeaderCellInner) as StructuralHeaderCellComponent

/* ------------------------------------------------------------------ */
/* Celda de la fila de filtros                                         */
/* ------------------------------------------------------------------ */

function FilterCellInner<T>({ item }: { item: LayoutCol<T> }) {
  const { labels, classNames } = useTableConfig<T>()
  const { facets } = useTableData<T>()
  const dispatch = useTableDispatch()
  const column = item.column

  // La regla conserva identidad salvo que cambie ESTE filtro.
  const rule = useTableSelector((state) =>
    column ? state.committed.filters.find((f) => f.id === column.id) : undefined,
  )

  return (
    <th
      className={cx(
        s.filterCell,
        item.pin && s.pinned,
        item.isPinEdge && (item.pin === 'left' ? s.pinLeftEdge : s.pinRightEdge),
        classNames?.filterCell,
      )}
      style={item.stickyStyle}
    >
      {column?.filter && column.filter.kind !== 'none' && (
        <div className={s.filterInner}>
          <FilterControl
            column={column}
            rule={rule}
            setRule={(next) => dispatch({ type: 'filter/set', id: column.id, rule: next })}
            labels={labels}
            facets={facets(column.id)}
            debounceMs={FILTER_DEBOUNCE}
          />
        </div>
      )}
    </th>
  )
}

type FilterCellComponent = <T>(props: { item: LayoutCol<T> }) => ReactNode
export const FilterCell: FilterCellComponent = memo(FilterCellInner) as FilterCellComponent
