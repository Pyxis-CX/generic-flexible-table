'use client'

import { memo } from 'react'
import type { FC } from 'react'
import s from '../DataTable.module.css'
import { useTableConfig } from '../context'
import { IconArrowDown, IconArrowUp, IconX } from '../icons'
import { useTableDispatch, useTableSelector } from '../store'

/**
 * Hace visible el orden múltiple: un chip por columna, numerado según el
 * orden en que se aplicó, que es exactamente el orden del `ORDER BY`.
 */
function SortBarInner() {
  const { columnById, labels } = useTableConfig<unknown>()
  const dispatch = useTableDispatch()
  const sorts = useTableSelector((state) => state.committed.sorts)

  if (sorts.length === 0) return null

  return (
    <div className={s.sortBar}>
      <span className={s.sortBarLabel}>{labels.sortOrder}</span>
      <ol className={s.sortChips}>
        {sorts.map((rule, index) => {
          const column = columnById.get(rule.id)
          const name =
            column && typeof column.header === 'string'
              ? column.header
              : (column?.exportHeader ?? rule.id)
          return (
            <li key={rule.id} className={s.sortChip}>
              <span className={s.sortChipIndex} aria-hidden>
                {index + 1}
              </span>
              <button
                type="button"
                className={s.sortChipMain}
                onClick={() =>
                  dispatch({
                    type: 'sort/set',
                    id: rule.id,
                    dir: rule.dir === 'asc' ? 'desc' : 'asc',
                    keepOthers: true,
                  })
                }
                title={rule.dir === 'asc' ? labels.sortDesc : labels.sortAsc}
              >
                <span className={s.srOnly}>{`${index + 1}. `}</span>
                {name}
                {rule.dir === 'asc' ? (
                  <IconArrowUp width={12} height={12} />
                ) : (
                  <IconArrowDown width={12} height={12} />
                )}
              </button>
              <span className={s.sortChipMove}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'sort/move', id: rule.id, delta: -1 })}
                  disabled={index === 0}
                  aria-label={`Adelantar ${name} en el orden`}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'sort/move', id: rule.id, delta: 1 })}
                  disabled={index === sorts.length - 1}
                  aria-label={`Retrasar ${name} en el orden`}
                >
                  ›
                </button>
              </span>
              <button
                type="button"
                className={s.sortChipRemove}
                onClick={() => dispatch({ type: 'sort/set', id: rule.id, dir: null, keepOthers: true })}
                aria-label={`${labels.clearSort}: ${name}`}
              >
                <IconX width={11} height={11} />
              </button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        className={s.sortBarClear}
        onClick={() => dispatch({ type: 'sort/clear' })}
      >
        {labels.clearAllSorts}
      </button>
    </div>
  )
}

export const SortBar: FC = memo(SortBarInner)
