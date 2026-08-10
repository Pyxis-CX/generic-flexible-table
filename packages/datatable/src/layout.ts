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

export type SlotKind = 'select' | 'expander' | 'data' | 'actions' | 'filler' | 'hspacer'

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
  /** Offsets sticky ya calculados (inset-inline-*: RTL gratis; suman `var()`s). */
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
    item.stickyStyle = { insetInlineStart: acc.length ? `calc(${acc.join(' + ')})` : 0 }
    acc.push(item.widthExpr!)
  }
  if (left.length) left[left.length - 1].isPinEdge = true

  acc.length = 0
  for (let i = right.length - 1; i >= 0; i--) {
    right[i].stickyStyle = { insetInlineEnd: acc.length ? `calc(${acc.join(' + ')})` : 0 }
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
  const parts = layout.filter((c) => c.widthExpr && c.kind !== 'hspacer').map((c) => c.widthExpr!)
  return parts.length ? `calc(${parts.join(' + ')})` : 'auto'
}

export interface ColumnWindow {
  /** Rango [start, end) sobre las columnas CENTRALES (no fijadas). */
  start: number
  end: number
  padStartPx: number
  padEndPx: number
}

/**
 * Ventana horizontal: conserva las columnas fijadas y los slots, recorta las
 * centrales al rango visible y rellena con dos spacers de ancho fijo para que
 * el scroll y los offsets sticky no se muevan. Las claves de columna se
 * mantienen → React reusa las celdas al desplazar la ventana.
 */
export function windowLayout<T>(layout: LayoutCol<T>[], window: ColumnWindow): LayoutCol<T>[] {
  const spacer = (key: string, px: number): LayoutCol<T> => ({
    key,
    kind: 'hspacer',
    column: null,
    widthExpr: `${px}px`,
    pin: null,
    isPinEdge: false,
    stickyStyle: {},
  })

  const out: LayoutCol<T>[] = []
  let centerIndex = 0
  let spacersPushed = false
  for (const item of layout) {
    const isCenter = item.pin === null && (item.kind === 'data' || item.kind === 'filler')
    if (!isCenter) {
      out.push(item)
      continue
    }
    if (item.kind === 'filler') {
      out.push(item)
      continue
    }
    if (!spacersPushed && window.padStartPx > 0) {
      out.push(spacer('__hspL__', window.padStartPx))
      spacersPushed = true
    }
    if (centerIndex >= window.start && centerIndex < window.end) out.push(item)
    centerIndex++
  }
  if (window.padEndPx > 0) {
    // insertar antes del filler/pinned-right para no romper el orden visual
    const fillerAt = out.findIndex((c) => c.kind === 'filler' || c.pin === 'right')
    const sp = spacer('__hspR__', window.padEndPx)
    if (fillerAt >= 0) out.splice(fillerAt, 0, sp)
    else out.push(sp)
  }
  return out
}
