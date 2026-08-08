import type { CSSProperties } from 'react'
import {
  ACTIONS_KEY,
  ACTIONS_WIDTH,
  DEFAULT_WIDTH,
  EXPANDER_KEY,
  EXPANDER_WIDTH,
  FILLER_KEY,
  SELECT_KEY,
  SELECT_WIDTH,
} from './constants'
import type { ColumnDef, PinSide } from './types'

export type SlotKind = 'select' | 'expander' | 'data' | 'actions' | 'filler'

/**
 * Los anchos NO viven aquí: cada columna es `var(--dt-w-<id>)`. Así el layout
 * (y todo lo que lo recibe por props) permanece **estable durante el resize**:
 * el arrastre solo escribe la variable en el elemento raíz.
 */
export interface LayoutCol<T> {
  key: string
  kind: SlotKind
  column: ColumnDef<T> | null
  /** Valor CSS del ancho: `var(--dt-w-x, 170px)` o `46px` para slots fijos. */
  widthExpr: string | null
  pin: PinSide | null
  isPinEdge: boolean
  /** `left`/`right` ya calculados para sticky (suman `var()`s → viven en CSS). */
  stickyStyle: CSSProperties
}

const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_')

/** Nombre de la CSS var que controla el ancho de una columna. */
export const widthVarOf = (columnId: string) => `--dt-w-${sanitize(columnId)}`

export interface BuildLayoutInput<T> {
  visibleColumns: ColumnDef<T>[]
  pins: Record<string, PinSide | null>
  pinningEnabled: boolean
  hasSelection: boolean
  hasExpander: boolean
  hasActions: boolean
}

export function buildLayout<T>(input: BuildLayoutInput<T>): LayoutCol<T>[] {
  const { visibleColumns, pins, pinningEnabled, hasSelection, hasExpander, hasActions } = input

  const left: LayoutCol<T>[] = []
  const center: LayoutCol<T>[] = []
  const right: LayoutCol<T>[] = []

  const slot = (key: string, kind: SlotKind, width: number, pin: PinSide): LayoutCol<T> => ({
    key,
    kind,
    column: null,
    widthExpr: `${width}px`,
    pin,
    isPinEdge: false,
    stickyStyle: {},
  })

  if (hasSelection) left.push(slot(SELECT_KEY, 'select', SELECT_WIDTH, 'left'))
  if (hasExpander) left.push(slot(EXPANDER_KEY, 'expander', EXPANDER_WIDTH, 'left'))

  for (const column of visibleColumns) {
    const pin = pinningEnabled ? (pins[column.id] ?? null) : null
    const item: LayoutCol<T> = {
      key: column.id,
      kind: 'data',
      column,
      widthExpr: `var(${widthVarOf(column.id)}, ${column.width ?? DEFAULT_WIDTH}px)`,
      pin,
      isPinEdge: false,
      stickyStyle: {},
    }
    if (pin === 'left') left.push(item)
    else if (pin === 'right') right.push(item)
    else center.push(item)
  }

  if (hasActions) right.push(slot(ACTIONS_KEY, 'actions', ACTIONS_WIDTH, 'right'))

  // Offsets acumulados como expresión calc(): el navegador re-deriva las
  // posiciones sticky cuando cambia una var de ancho, sin re-render.
  const acc: string[] = []
  for (const item of left) {
    item.stickyStyle = { left: acc.length ? `calc(${acc.join(' + ')})` : 0 }
    acc.push(item.widthExpr!)
  }
  if (left.length) left[left.length - 1].isPinEdge = true

  acc.length = 0
  for (let i = right.length - 1; i >= 0; i--) {
    right[i].stickyStyle = { right: acc.length ? `calc(${acc.join(' + ')})` : 0 }
    acc.push(right[i].widthExpr!)
  }
  if (right.length) right[0].isPinEdge = true

  const filler: LayoutCol<T> = {
    key: FILLER_KEY,
    kind: 'filler',
    column: null,
    widthExpr: null,
    pin: null,
    isPinEdge: false,
    stickyStyle: {},
  }

  return [...left, ...center, filler, ...right]
}

/** `min-width` de la tabla: suma de todos los anchos, también en CSS. */
export function tableMinWidthExpr<T>(layout: LayoutCol<T>[]): string {
  const parts = layout.filter((c) => c.widthExpr).map((c) => c.widthExpr!)
  return parts.length ? `calc(${parts.join(' + ')})` : 'auto'
}
