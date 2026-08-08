'use client'

import { memo } from 'react'
import type { FC } from 'react'
import s from '../DataTable.module.css'
import { useTableConfig, useTableData } from '../context'
import { useTableDispatch, useTableSelector } from '../store'
import { clamp } from '../utils'
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '../icons'

function FooterInner() {
  const { labels, pageSizeOptions, classNames } = useTableConfig<unknown>()
  const { total, pageCount, loading, pageRows } = useTableData<unknown>()
  const dispatch = useTableDispatch()
  const page = useTableSelector((state) => state.committed.page)
  const pageSize = useTableSelector((state) => state.committed.pageSize)

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : from + pageRows.length - 1
  const goTo = (p: number) => dispatch({ type: 'page/set', page: clamp(p, 1, pageCount) })

  return (
    <div className={`${s.footer} ${classNames?.footer ?? ''}`}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {labels.rowsPerPage}
        <select
          value={pageSize}
          onChange={(e) => dispatch({ type: 'pageSize/set', size: Number(e.target.value) })}
          aria-label={labels.rowsPerPage}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <span className={s.pageInfo} aria-live="polite">
        {from}–{to} {labels.of} {total.toLocaleString()}
      </span>

      <div className={s.spacer} />

      <span className={s.pageInfo}>
        {labels.page} {page} {labels.of} {Math.max(1, pageCount)}
      </span>

      <div className={s.pageGroup}>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => goTo(1)}
          disabled={page <= 1 || loading}
          aria-label={labels.first}
        >
          <IconChevronsLeft />
        </button>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => goTo(page - 1)}
          disabled={page <= 1 || loading}
          aria-label={labels.prev}
        >
          <IconChevronLeft />
        </button>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => goTo(page + 1)}
          disabled={page >= pageCount || loading}
          aria-label={labels.next}
        >
          <IconChevronRight />
        </button>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => goTo(pageCount)}
          disabled={page >= pageCount || loading}
          aria-label={labels.last}
        >
          <IconChevronsRight />
        </button>
      </div>
    </div>
  )
}

export const Footer: FC = memo(FooterInner)
