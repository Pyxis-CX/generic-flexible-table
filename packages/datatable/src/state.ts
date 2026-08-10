import { DEFAULT_WIDTH } from './constants'
import type { ColumnDef, Density, FilterRule, PinSide, SortDir, TableState } from './types'

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

/**
 * Estado de interacción: cambia a ritmo de puntero y **no** se persiste ni
 * dispara el pipeline de datos. Vive junto al confirmado para que un único
 * store pueda servirlo por selectores.
 */
export interface InteractionState {
  selection: ReadonlySet<string>
  expanded: ReadonlySet<string>
  dragId: string | null
  dropTarget: { id: string; side: 'before' | 'after' } | null
  resizingId: string | null
}

export interface RuntimeState {
  /** Lo que se persiste y lo que alimenta la consulta de datos. */
  committed: TableState
  ui: InteractionState
}

export type TableAction =
  | { type: 'reset'; state: TableState }
  /** Reemplaza el estado confirmado sin tocar la interacción (modo controlado). */
  | { type: 'state/replace'; state: TableState }
  | { type: 'columns/reconcile'; ids: string[]; widths: Record<string, number>; pins: Record<string, PinSide | null> }
  | { type: 'columns/move'; id: string; delta: -1 | 1 }
  | { type: 'columns/reorder'; fromId: string; toId: string; side: 'before' | 'after' }
  | { type: 'columns/toggle'; id: string }
  | { type: 'columns/setHidden'; hidden: string[] }
  | { type: 'columns/pin'; id: string; side: PinSide | null }
  | { type: 'columns/resize'; id: string; width: number }
  | { type: 'sort/toggle'; id: string; keepOthers: boolean }
  | { type: 'sort/set'; id: string; dir: SortDir | null; keepOthers: boolean }
  | { type: 'sort/clear' }
  | { type: 'sort/move'; id: string; delta: -1 | 1 }
  | { type: 'filter/set'; id: string; rule: FilterRule | undefined }
  | { type: 'search/set'; value: string }
  | { type: 'page/set'; page: number }
  | { type: 'pageSize/set'; size: number }
  | { type: 'density/set'; density: Density }
  | { type: 'selection/set'; ids: string[] }
  | { type: 'selection/toggleRow'; id: string }
  | { type: 'selection/setPage'; ids: string[]; select: boolean }
  | { type: 'expanded/toggle'; id: string }
  | { type: 'drag/start'; id: string }
  | { type: 'drag/over'; target: { id: string; side: 'before' | 'after' } | null }
  | { type: 'drag/end' }
  | { type: 'resize/start'; id: string }
  | { type: 'resize/end' }

export const EMPTY_INTERACTION: InteractionState = {
  selection: new Set(),
  expanded: new Set(),
  dragId: null,
  dropTarget: null,
  resizingId: null,
}

export function buildTableState<T>(
  columns: ColumnDef<T>[],
  initial?: Partial<TableState>,
): TableState {
  return {
    order: columns.map((c) => c.id),
    hidden: columns.filter((c) => c.hidden).map((c) => c.id),
    widths: Object.fromEntries(columns.map((c) => [c.id, c.width ?? DEFAULT_WIDTH])),
    pins: Object.fromEntries(columns.map((c) => [c.id, c.pin ?? null])),
    sorts: [],
    filters: [],
    globalSearch: '',
    page: 1,
    pageSize: 25,
    density: 'normal',
    ...initial,
  }
}

/** Mantiene el orden guardado y añade al final las columnas nuevas. */
export function reconcileOrder(saved: string[], ids: string[]): string[] {
  const known = new Set(ids)
  const kept = saved.filter((id) => known.has(id))
  const seen = new Set(kept)
  return [...kept, ...ids.filter((id) => !seen.has(id))]
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

/** Toda mutación del estado confirmado invalida la página actual. */
function commit(state: RuntimeState, patch: Partial<TableState>, resetPage = false): RuntimeState {
  return { ...state, committed: { ...state.committed, ...patch, ...(resetPage ? { page: 1 } : null) } }
}

function withUi(state: RuntimeState, patch: Partial<InteractionState>): RuntimeState {
  return { ...state, ui: { ...state.ui, ...patch } }
}

const sameArray = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

export function tableReducer(state: RuntimeState, action: TableAction): RuntimeState {
  const { committed: c } = state

  switch (action.type) {
    case 'reset':
      return { committed: action.state, ui: EMPTY_INTERACTION }

    case 'state/replace':
      return action.state === c ? state : { ...state, committed: action.state }

    case 'columns/reconcile': {
      const order = reconcileOrder(c.order, action.ids)
      const sameOrder = sameArray(order, c.order)
      const widths = { ...action.widths, ...c.widths }
      const pins = { ...action.pins, ...c.pins }
      const sameWidths = Object.keys(widths).length === Object.keys(c.widths).length
      const samePins = Object.keys(pins).length === Object.keys(c.pins).length
      if (sameOrder && sameWidths && samePins) return state
      return commit(state, { order, widths, pins })
    }

    case 'columns/move': {
      const from = c.order.indexOf(action.id)
      const to = from + action.delta
      if (from < 0 || to < 0 || to >= c.order.length) return state
      const order = [...c.order]
      const [item] = order.splice(from, 1)
      order.splice(to, 0, item)
      return commit(state, { order })
    }

    case 'columns/reorder': {
      if (action.fromId === action.toId) return state
      const order = c.order.filter((id) => id !== action.fromId)
      const target = order.indexOf(action.toId)
      if (target < 0) return state
      order.splice(action.side === 'before' ? target : target + 1, 0, action.fromId)
      if (sameArray(order, c.order)) return state
      return commit(state, { order })
    }

    case 'columns/toggle':
      return commit(state, {
        hidden: c.hidden.includes(action.id)
          ? c.hidden.filter((x) => x !== action.id)
          : [...c.hidden, action.id],
      })

    case 'columns/setHidden':
      return sameArray(action.hidden, c.hidden) ? state : commit(state, { hidden: action.hidden })

    case 'columns/pin':
      return c.pins[action.id] === action.side
        ? state
        : commit(state, { pins: { ...c.pins, [action.id]: action.side } })

    case 'columns/resize':
      return c.widths[action.id] === action.width
        ? state
        : commit(state, { widths: { ...c.widths, [action.id]: action.width } })

    case 'sort/toggle': {
      const existing = c.sorts.find((r) => r.id === action.id)
      // Ciclo por columna: sin orden → asc → desc → sin orden.
      const nextDir: SortDir | null = !existing ? 'asc' : existing.dir === 'asc' ? 'desc' : null

      if (!action.keepOthers) {
        return commit(state, { sorts: nextDir ? [{ id: action.id, dir: nextDir }] : [] }, true)
      }
      if (!existing) {
        return commit(state, { sorts: [...c.sorts, { id: action.id, dir: 'asc' }] }, true)
      }
      // Cambiar de dirección NO mueve la columna dentro del orden aplicado.
      if (nextDir) {
        return commit(
          state,
          { sorts: c.sorts.map((r) => (r.id === action.id ? { ...r, dir: nextDir } : r)) },
          true,
        )
      }
      return commit(state, { sorts: c.sorts.filter((r) => r.id !== action.id) }, true)
    }

    case 'sort/set': {
      if (action.dir === null) {
        return commit(state, { sorts: c.sorts.filter((r) => r.id !== action.id) }, true)
      }
      const exists = c.sorts.some((r) => r.id === action.id)
      if (exists && action.keepOthers) {
        return commit(
          state,
          { sorts: c.sorts.map((r) => (r.id === action.id ? { ...r, dir: action.dir! } : r)) },
          true,
        )
      }
      const base = action.keepOthers ? c.sorts.filter((r) => r.id !== action.id) : []
      return commit(state, { sorts: [...base, { id: action.id, dir: action.dir }] }, true)
    }

    case 'sort/clear':
      return c.sorts.length === 0 ? state : commit(state, { sorts: [] }, true)

    case 'sort/move': {
      const from = c.sorts.findIndex((r) => r.id === action.id)
      const to = from + action.delta
      if (from < 0 || to < 0 || to >= c.sorts.length) return state
      const sorts = [...c.sorts]
      const [rule] = sorts.splice(from, 1)
      sorts.splice(to, 0, rule)
      return commit(state, { sorts }, true)
    }

    case 'filter/set': {
      const others = c.filters.filter((f) => f.id !== action.id)
      return commit(state, { filters: action.rule ? [...others, action.rule] : others }, true)
    }

    case 'search/set':
      return c.globalSearch === action.value ? state : commit(state, { globalSearch: action.value }, true)

    case 'page/set':
      return c.page === action.page ? state : commit(state, { page: action.page })

    case 'pageSize/set':
      return c.pageSize === action.size ? state : commit(state, { pageSize: action.size }, true)

    case 'density/set':
      return c.density === action.density ? state : commit(state, { density: action.density })

    case 'selection/set':
      return withUi(state, { selection: new Set(action.ids) })

    case 'selection/toggleRow': {
      const selection = new Set(state.ui.selection)
      if (!selection.delete(action.id)) selection.add(action.id)
      return withUi(state, { selection })
    }

    case 'selection/setPage': {
      const selection = new Set(state.ui.selection)
      for (const id of action.ids) {
        if (action.select) selection.add(id)
        else selection.delete(id)
      }
      return withUi(state, { selection })
    }

    case 'expanded/toggle': {
      const expanded = new Set(state.ui.expanded)
      if (!expanded.delete(action.id)) expanded.add(action.id)
      return withUi(state, { expanded })
    }

    case 'drag/start':
      return withUi(state, { dragId: action.id, dropTarget: null })

    case 'drag/over': {
      const prev = state.ui.dropTarget
      const next = action.target
      if (prev?.id === next?.id && prev?.side === next?.side) return state
      return withUi(state, { dropTarget: next })
    }

    case 'drag/end':
      return state.ui.dragId === null && state.ui.dropTarget === null
        ? state
        : withUi(state, { dragId: null, dropTarget: null })

    case 'resize/start':
      return withUi(state, { resizingId: action.id })

    case 'resize/end':
      return state.ui.resizingId === null ? state : withUi(state, { resizingId: null })

    default:
      return state
  }
}
