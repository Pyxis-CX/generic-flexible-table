'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { DataSource, QueryState } from './types'

/* ------------------------------------------------------------------ */
/* Debounce                                                            */
/* ------------------------------------------------------------------ */

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value)
      return
    }
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

/* ------------------------------------------------------------------ */
/* Virtualización de filas (altura fija)                               */
/* ------------------------------------------------------------------ */

export interface VirtualRange {
  start: number
  end: number
  padTop: number
  padBottom: number
}

export function useVirtualRows(params: {
  enabled: boolean
  count: number
  rowHeight: number
  overscan: number
  scrollRef: RefObject<HTMLElement | null>
}): VirtualRange {
  const { enabled, count, rowHeight, overscan, scrollRef } = params
  const [range, setRange] = useState<VirtualRange>({
    start: 0,
    end: count,
    padTop: 0,
    padBottom: 0,
  })

  const compute = useCallback(() => {
    const el = scrollRef.current
    if (!enabled || !el || rowHeight <= 0) {
      setRange({ start: 0, end: count, padTop: 0, padBottom: 0 })
      return
    }
    // El thead es sticky, así que la primera fila visible sale directo de scrollTop.
    const first = Math.floor(el.scrollTop / rowHeight)
    const visible = Math.ceil(el.clientHeight / rowHeight)
    const start = Math.max(0, first - overscan)
    const end = Math.min(count, first + visible + overscan)
    setRange((prev) =>
      prev.start === start && prev.end === end
        ? prev
        : {
            start,
            end,
            padTop: start * rowHeight,
            padBottom: Math.max(0, (count - end) * rowHeight),
          },
    )
  }, [enabled, count, rowHeight, overscan, scrollRef])

  useLayoutEffect(() => {
    compute()
  }, [compute])

  useEffect(() => {
    const el = scrollRef.current
    if (!enabled || !el) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        compute()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, compute, scrollRef])

  return range
}

/* ------------------------------------------------------------------ */
/* Virtualización de columnas (ventana horizontal)                     */
/* ------------------------------------------------------------------ */

export interface ColumnWindowState {
  start: number
  end: number
  padStartPx: number
  padEndPx: number
}

const FULL_WINDOW: ColumnWindowState = { start: 0, end: Infinity, padStartPx: 0, padEndPx: 0 }

export function useVirtualColumns(params: {
  enabled: boolean
  /** Anchos px de las columnas centrales (no fijadas), en orden visual. */
  widths: number[]
  /** Ancho ocupado por columnas fijadas y slots: se resta del viewport. */
  pinnedWidthPx: number
  overscan: number
  scrollRef: RefObject<HTMLElement | null>
}): ColumnWindowState {
  const { enabled, widths, pinnedWidthPx, overscan, scrollRef } = params
  const [window_, setWindow] = useState<ColumnWindowState>(FULL_WINDOW)

  const compute = useCallback(() => {
    const el = scrollRef.current
    if (!enabled || !el || widths.length === 0) {
      setWindow((prev) => (prev === FULL_WINDOW ? prev : FULL_WINDOW))
      return
    }
    // RTL: scrollLeft es negativo en Chrome/Firefox → distancia absoluta.
    const scrolled = Math.abs(el.scrollLeft)
    const viewport = Math.max(0, el.clientWidth - pinnedWidthPx)

    let acc = 0
    let start = 0
    while (start < widths.length && acc + widths[start] < scrolled) acc += widths[start++]
    let end = start
    let visible = acc
    while (end < widths.length && visible < scrolled + viewport) visible += widths[end++]

    start = Math.max(0, start - overscan)
    end = Math.min(widths.length, end + overscan)

    let padStartPx = 0
    for (let i = 0; i < start; i++) padStartPx += widths[i]
    let padEndPx = 0
    for (let i = end; i < widths.length; i++) padEndPx += widths[i]

    setWindow((prev) =>
      prev.start === start && prev.end === end && prev.padStartPx === padStartPx
        ? prev
        : { start, end, padStartPx, padEndPx },
    )
  }, [enabled, widths, pinnedWidthPx, overscan, scrollRef])

  useLayoutEffect(() => {
    compute()
  }, [compute])

  useEffect(() => {
    const el = scrollRef.current
    if (!enabled || !el) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        compute()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, compute, scrollRef])

  return window_
}

/* ------------------------------------------------------------------ */
/* Data source                                                         */
/* ------------------------------------------------------------------ */

export interface DataState<T> {
  rows: T[]
  total: number
  loading: boolean
  error: Error | null
}

/** `source: null` (modo client, resuelto en memoria) deja el hook inerte. */
export function useDataSource<T>(
  source: DataSource<T> | null,
  query: QueryState,
  sourceKey: string,
): DataState<T> & { refetch: () => void } {
  const [state, setState] = useState<DataState<T>>({
    rows: [],
    total: 0,
    loading: source?.mode === 'server',
    error: null,
  })
  const [reloadToken, setReloadToken] = useState(0)

  // Se leen por ref para que el efecto dependa solo de claves serializadas
  // y nunca de la identidad de los objetos.
  const sourceRef = useRef(source)
  sourceRef.current = source
  const queryRef = useRef(query)
  queryRef.current = query

  const queryKey = JSON.stringify(query)

  useEffect(() => {
    if (!sourceRef.current) return
    const controller = new AbortController()
    let cancelled = false

    let result: ReturnType<DataSource<T>['fetch']>
    try {
      result = sourceRef.current.fetch(queryRef.current, controller.signal)
    } catch (err) {
      setState({ rows: [], total: 0, loading: false, error: toError(err) })
      return
    }

    if (result instanceof Promise) {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      result
        .then((value) => {
          if (cancelled) return
          setState({ rows: value.rows, total: value.total, loading: false, error: null })
        })
        .catch((err: unknown) => {
          if (cancelled || (err as Error)?.name === 'AbortError') return
          setState((prev) => ({ ...prev, loading: false, error: toError(err) }))
        })
    } else {
      setState({ rows: result.rows, total: result.total, loading: false, error: null })
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [queryKey, sourceKey, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { ...state, refetch }
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}
