import { describe, expect, it } from 'vitest'
import { EMPTY_INTERACTION, buildTableState, reconcileOrder, tableReducer } from '../src/state'
import type { RuntimeState, TableAction } from '../src/state'
import type { ColumnDef } from '../src/types'

const columns: ColumnDef<{ a: number }>[] = [
  { id: 'a', header: 'A' },
  { id: 'b', header: 'B' },
  { id: 'c', header: 'C' },
]

const initial = (): RuntimeState => ({
  committed: buildTableState(columns),
  ui: EMPTY_INTERACTION,
})

const run = (state: RuntimeState, ...actions: TableAction[]) =>
  actions.reduce(tableReducer, state)

describe('sort/toggle (modo acumulativo)', () => {
  it('clic en columnas distintas ACUMULA en orden de aplicación', () => {
    const s = run(
      initial(),
      { type: 'sort/toggle', id: 'b', keepOthers: true },
      { type: 'sort/toggle', id: 'a', keepOthers: true },
    )
    expect(s.committed.sorts).toEqual([
      { id: 'b', dir: 'asc' },
      { id: 'a', dir: 'asc' },
    ])
  })

  it('ciclo asc → desc → fuera, sin perder la posición al cambiar dirección', () => {
    let s = run(
      initial(),
      { type: 'sort/toggle', id: 'b', keepOthers: true },
      { type: 'sort/toggle', id: 'a', keepOthers: true },
      { type: 'sort/toggle', id: 'b', keepOthers: true }, // b pasa a desc
    )
    expect(s.committed.sorts).toEqual([
      { id: 'b', dir: 'desc' }, // sigue PRIMERO
      { id: 'a', dir: 'asc' },
    ])
    s = run(s, { type: 'sort/toggle', id: 'b', keepOthers: true }) // b sale
    expect(s.committed.sorts).toEqual([{ id: 'a', dir: 'asc' }])
  })

  it('keepOthers=false (modificador) reemplaza todo el orden', () => {
    const s = run(
      initial(),
      { type: 'sort/toggle', id: 'b', keepOthers: true },
      { type: 'sort/toggle', id: 'a', keepOthers: false },
    )
    expect(s.committed.sorts).toEqual([{ id: 'a', dir: 'asc' }])
  })

  it('cualquier cambio de orden resetea la página a 1', () => {
    let s = run(initial(), { type: 'page/set', page: 4 })
    expect(s.committed.page).toBe(4)
    s = run(s, { type: 'sort/toggle', id: 'a', keepOthers: true })
    expect(s.committed.page).toBe(1)
  })
})

describe('sort/move y sort/set', () => {
  it('move cambia la prioridad sin tocar direcciones', () => {
    const s = run(
      initial(),
      { type: 'sort/toggle', id: 'a', keepOthers: true },
      { type: 'sort/toggle', id: 'b', keepOthers: true },
      { type: 'sort/toggle', id: 'b', keepOthers: true }, // b: desc
      { type: 'sort/move', id: 'b', delta: -1 },
    )
    expect(s.committed.sorts).toEqual([
      { id: 'b', dir: 'desc' },
      { id: 'a', dir: 'asc' },
    ])
  })

  it('move fuera de rango es no-op (misma referencia)', () => {
    const s = run(initial(), { type: 'sort/toggle', id: 'a', keepOthers: true })
    expect(tableReducer(s, { type: 'sort/move', id: 'a', delta: -1 })).toBe(s)
  })

  it('sort/set dir=null saca la columna; keepOthers=false deja solo esa', () => {
    let s = run(
      initial(),
      { type: 'sort/set', id: 'a', dir: 'desc', keepOthers: true },
      { type: 'sort/set', id: 'b', dir: 'asc', keepOthers: true },
    )
    s = run(s, { type: 'sort/set', id: 'c', dir: 'asc', keepOthers: false })
    expect(s.committed.sorts).toEqual([{ id: 'c', dir: 'asc' }])
    s = run(s, { type: 'sort/set', id: 'c', dir: null, keepOthers: true })
    expect(s.committed.sorts).toEqual([])
  })
})

describe('columnas', () => {
  it('reorder before/after', () => {
    let s = run(initial(), { type: 'columns/reorder', fromId: 'c', toId: 'a', side: 'before' })
    expect(s.committed.order).toEqual(['c', 'a', 'b'])
    s = run(s, { type: 'columns/reorder', fromId: 'c', toId: 'b', side: 'after' })
    expect(s.committed.order).toEqual(['a', 'b', 'c'])
  })

  it('resize idéntico es no-op (misma referencia, no dispara persistencia)', () => {
    const s = run(initial(), { type: 'columns/resize', id: 'a', width: 200 })
    expect(tableReducer(s, { type: 'columns/resize', id: 'a', width: 200 })).toBe(s)
  })

  it('toggle de visibilidad', () => {
    let s = run(initial(), { type: 'columns/toggle', id: 'b' })
    expect(s.committed.hidden).toEqual(['b'])
    s = run(s, { type: 'columns/toggle', id: 'b' })
    expect(s.committed.hidden).toEqual([])
  })
})

describe('selección y expansión (estado de interacción)', () => {
  it('toggleRow y setPage', () => {
    let s = run(initial(), { type: 'selection/toggleRow', id: 'x' })
    expect([...s.ui.selection]).toEqual(['x'])
    s = run(s, { type: 'selection/setPage', ids: ['a', 'b'], select: true })
    expect(s.ui.selection.size).toBe(3)
    s = run(s, { type: 'selection/setPage', ids: ['a', 'x'], select: false })
    expect([...s.ui.selection]).toEqual(['b'])
  })

  it('mutar selección NO toca el estado confirmado (identidad intacta)', () => {
    const s0 = initial()
    const s1 = run(s0, { type: 'selection/toggleRow', id: 'x' })
    expect(s1.committed).toBe(s0.committed)
  })

  it('drag/over con el mismo target es no-op', () => {
    const s = run(initial(), { type: 'drag/over', target: { id: 'a', side: 'before' } })
    expect(tableReducer(s, { type: 'drag/over', target: { id: 'a', side: 'before' } })).toBe(s)
  })
})

describe('state/replace (modo controlado)', () => {
  it('reemplaza el confirmado sin tocar la interacción', () => {
    let s = run(initial(), { type: 'selection/toggleRow', id: 'x' })
    const next = { ...buildTableState(columns), page: 7 }
    s = run(s, { type: 'state/replace', state: next })
    expect(s.committed.page).toBe(7)
    expect([...s.ui.selection]).toEqual(['x']) // la selección sobrevive
  })

  it('misma referencia es no-op', () => {
    const s = initial()
    expect(tableReducer(s, { type: 'state/replace', state: s.committed })).toBe(s)
  })
})

describe('reconcileOrder', () => {
  it('conserva el orden guardado, añade columnas nuevas al final, elimina huérfanas', () => {
    expect(reconcileOrder(['c', 'a', 'zombi'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
  })
})

describe('filtros y búsqueda', () => {
  it('filter/set reemplaza la regla de SU columna y resetea página', () => {
    let s = run(initial(), { type: 'page/set', page: 3 })
    s = run(s, { type: 'filter/set', id: 'a', rule: { id: 'a', operator: 'contains', value: 'x' } })
    s = run(s, { type: 'filter/set', id: 'b', rule: { id: 'b', operator: 'equals', value: 1 } })
    s = run(s, { type: 'filter/set', id: 'a', rule: { id: 'a', operator: 'contains', value: 'y' } })
    expect(s.committed.filters).toHaveLength(2)
    expect(s.committed.filters.find((f) => f.id === 'a')?.value).toBe('y')
    expect(s.committed.page).toBe(1)
    s = run(s, { type: 'filter/set', id: 'a', rule: undefined })
    expect(s.committed.filters).toHaveLength(1)
  })
})
