import type { Density } from './types'

export const DEFAULT_WIDTH = 170
export const MIN_WIDTH = 56
export const MAX_WIDTH = 960

export const SELECT_WIDTH = 46
export const EXPANDER_WIDTH = 40
export const ACTIONS_WIDTH = 110

export const FILTER_DEBOUNCE = 300

/** Solo sirve de valor inicial: la altura real se mide del DOM. */
export const DENSITY_ROW_HEIGHT: Record<Density, number> = {
  compact: 34,
  normal: 44,
  comfortable: 58,
}

export const SELECT_KEY = '__select__'
export const EXPANDER_KEY = '__expander__'
export const ACTIONS_KEY = '__actions__'
export const FILLER_KEY = '__filler__'
