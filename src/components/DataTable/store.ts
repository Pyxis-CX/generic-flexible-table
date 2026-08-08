import { createContext, useContext, useRef, useSyncExternalStore } from 'react'
import { EMPTY_INTERACTION, tableReducer } from './state'
import type { RuntimeState, TableAction } from './state'
import type { SortDir, TableState } from './types'

/**
 * Store externo mínimo (patrón useSyncExternalStore).
 *
 * Por qué no useState arriba + props hacia abajo:
 *  - cada componente se suscribe a la **porción** que le interesa vía
 *    selector: marcar un checkbox re-renderiza 1 fila, no 750 celdas;
 *  - `dispatch` tiene identidad estable y llega por contexto, así que los
 *    componentes hoja no reciben callbacks por props (cero prop drilling)
 *    y `memo` no se invalida;
 *  - es el mismo contrato que Zustand vanilla (`createStore`): si algún día
 *    se prefiere la librería, el swap es 1:1 y los componentes no se tocan.
 */
export interface TableStore {
  getState: () => RuntimeState
  dispatch: (action: TableAction) => void
  subscribe: (listener: () => void) => () => void
}

export function createTableStore(initial: TableState): TableStore {
  let state: RuntimeState = { committed: initial, ui: EMPTY_INTERACTION }
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    dispatch(action) {
      const next = tableReducer(state, action)
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/* ------------------------------------------------------------------ */
/* React bindings                                                      */
/* ------------------------------------------------------------------ */

export const StoreContext = createContext<TableStore | null>(null)

export function useTableStore(): TableStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('DataTable: componente usado fuera de la tabla')
  return store
}

/**
 * Suscripción por selector. El componente solo se re-renderiza si el valor
 * seleccionado cambia (Object.is, o `isEqual` para valores derivados).
 * El caché garantiza que getSnapshot sea referencialmente estable entre
 * emisiones, que es lo que exige useSyncExternalStore.
 */
export function useTableSelector<R>(
  selector: (state: RuntimeState) => R,
  isEqual?: (a: R, b: R) => boolean,
): R {
  const store = useTableStore()
  const cacheRef = useRef<{ state: RuntimeState; value: R } | null>(null)

  const getSnapshot = () => {
    const state = store.getState()
    const cache = cacheRef.current
    if (cache && cache.state === state) return cache.value
    const next = selector(state)
    if (cache && (Object.is(cache.value, next) || (isEqual?.(cache.value, next) ?? false))) {
      cacheRef.current = { state, value: cache.value }
      return cache.value
    }
    cacheRef.current = { state, value: next }
    return next
  }

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}

export function useTableDispatch(): TableStore['dispatch'] {
  return useTableStore().dispatch
}

/* ------------------------------------------------------------------ */
/* Selectores de uso repetido                                          */
/* ------------------------------------------------------------------ */

export function useIsSelected(rowId: string): boolean {
  return useTableSelector((s) => s.ui.selection.has(rowId))
}

export function useIsExpanded(rowId: string): boolean {
  return useTableSelector((s) => s.ui.expanded.has(rowId))
}

export interface SortEntry {
  dir: SortDir | null
  /** 1-based; 0 si la columna no participa. */
  index: number
  count: number
}

const sortEntryEqual = (a: SortEntry, b: SortEntry) =>
  a.dir === b.dir && a.index === b.index && a.count === b.count

export function useSortEntry(columnId: string): SortEntry {
  return useTableSelector((s) => {
    const i = s.committed.sorts.findIndex((r) => r.id === columnId)
    return {
      dir: i >= 0 ? s.committed.sorts[i].dir : null,
      index: i + 1,
      count: s.committed.sorts.length,
    }
  }, sortEntryEqual)
}

export const shallowArrayEqual = <V,>(a: readonly V[], b: readonly V[]): boolean =>
  a === b || (a.length === b.length && a.every((x, i) => Object.is(x, b[i])))
