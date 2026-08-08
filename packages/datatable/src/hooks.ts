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
/* Persistencia en localStorage                                        */
/* ------------------------------------------------------------------ */

interface Persisted<T> {
  v: number
  s: T
}

export function readPersisted<T>(key: string | null, version: number): T | null {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Persisted<T>
    if (parsed.v !== version) return null
    return parsed.s
  } catch {
    return null
  }
}

export function writePersisted<T>(key: string | null, version: number, state: T): void {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: version, s: state } satisfies Persisted<T>))
  } catch {
    /* quota llena o modo privado: la tabla sigue funcionando sin persistir */
  }
}

export function clearPersisted(key: string | null): void {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* noop */
  }
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
