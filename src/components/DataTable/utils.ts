import type {
  ColumnDef,
  FilterOperator,
  FilterRule,
  SelectOption,
  SortRule,
  TableLabels,
  ThemeTokens,
} from './types'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Lee el valor crudo de una celda. `accessorFn` gana sobre `accessorKey`. */
export function getCellValue<T>(row: T, column: ColumnDef<T>): unknown {
  if (column.accessorFn) return column.accessorFn(row)
  if (column.accessorKey) return (row as Record<string, unknown>)[column.accessorKey]
  return undefined
}

/** Representación en texto plano: celda por defecto, CSV y PDF comparten esto. */
export function toPlainText<T>(value: unknown, row: T, column: ColumnDef<T>): string {
  if (column.formatValue) return column.formatValue(value, row)
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1 // vacíos al final en asc (y al principio en desc, por el signo)
  if (bEmpty) return -1

  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return collator.compare(String(a), String(b))
}

/* ------------------------------------------------------------------ */
/* Orden: claves precalculadas (transformación de Schwartz)            */
/* ------------------------------------------------------------------ */

/**
 * Un `sort` de N elementos hace ~N·log N comparaciones. Leer el accessor y
 * convertir el valor dentro del comparador multiplica ese coste por 2 en cada
 * comparación. Precalcular una clave por fila lo deja en N lecturas.
 */
interface SortKeys {
  /** Columnas numéricas (number, boolean, Date) → comparación aritmética. */
  nums: Float64Array | null
  /** El resto → `Intl.Collator`, con el `String()` ya hecho. */
  strs: string[] | null
  empty: Uint8Array
}

function buildSortKeys<T>(rows: T[], column: ColumnDef<T>): SortKeys {
  const n = rows.length
  const empty = new Uint8Array(n)
  const raw: unknown[] = new Array(n)
  let numeric = true

  for (let i = 0; i < n; i++) {
    const value = getCellValue(rows[i], column)
    if (value === null || value === undefined || value === '') {
      empty[i] = 1
      continue
    }
    raw[i] = value
    if (numeric && typeof value !== 'number' && typeof value !== 'boolean' && !(value instanceof Date)) {
      numeric = false
    }
  }

  if (numeric) {
    const nums = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      if (empty[i]) continue
      const value = raw[i]
      nums[i] =
        typeof value === 'number'
          ? value
          : typeof value === 'boolean'
            ? Number(value)
            : (value as Date).getTime()
    }
    return { nums, strs: null, empty }
  }

  const strs: string[] = new Array(n)
  for (let i = 0; i < n; i++) strs[i] = empty[i] ? '' : String(raw[i])
  return { nums: null, strs, empty }
}

function compareKeys(keys: SortKeys, a: number, b: number): number {
  const aEmpty = keys.empty[a]
  const bEmpty = keys.empty[b]
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (keys.nums) return keys.nums[a] - keys.nums[b]
  return collator.compare(keys.strs![a], keys.strs![b])
}

/** Ordena aplicando las reglas en el orden en que fueron añadidas (multi-sort estable). */
export function sortRows<T>(rows: T[], sorts: SortRule[], columns: ColumnDef<T>[]): T[] {
  if (sorts.length === 0) return rows
  const byId = new Map(columns.map((c) => [c.id, c]))

  const criteria = sorts
    .map((rule) => {
      const column = byId.get(rule.id)
      if (!column) return null
      return {
        sign: rule.dir === 'asc' ? 1 : -1,
        sortFn: column.sortFn,
        keys: column.sortFn ? null : buildSortKeys(rows, column),
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  if (criteria.length === 0) return rows

  // Se ordenan índices, no filas: el comparador solo toca arrays planos.
  const order: number[] = new Array(rows.length)
  for (let i = 0; i < rows.length; i++) order[i] = i

  order.sort((ia, ib) => {
    for (const criterion of criteria) {
      const result = criterion.keys
        ? compareKeys(criterion.keys, ia, ib)
        : criterion.sortFn!(rows[ia], rows[ib])
      if (result !== 0) return result * criterion.sign
    }
    return ia - ib // desempate por posición original → orden estable
  })

  const out: T[] = new Array(rows.length)
  for (let i = 0; i < order.length; i++) out[i] = rows[order[i]]
  return out
}

/* ------------------------------------------------------------------ */
/* Filtrado                                                            */
/* ------------------------------------------------------------------ */

function norm(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? null : n
}

function toTime(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const t = v instanceof Date ? v.getTime() : new Date(String(v)).getTime()
  return Number.isNaN(t) ? null : t
}

/** ¿La regla tiene un valor accionable? Las vacías se descartan. */
export function isFilterActive(rule: FilterRule): boolean {
  const v = rule.value
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) {
    if (rule.operator === 'between' || rule.operator === 'dateBetween') {
      return v.some((x) => x !== null && x !== undefined && x !== '')
    }
    return v.length > 0
  }
  return true
}

export function matchesRule(value: unknown, rule: FilterRule): boolean {
  const { operator, value: target } = rule

  switch (operator) {
    case 'contains':
      return norm(value).includes(norm(target))
    case 'notContains':
      return !norm(value).includes(norm(target))
    case 'startsWith':
      return norm(value).startsWith(norm(target))
    case 'endsWith':
      return norm(value).endsWith(norm(target))
    case 'equals': {
      if (typeof value === 'boolean') return value === (target === true || target === 'true')
      const n = toNumber(value)
      const tn = toNumber(target)
      if (n !== null && tn !== null) return n === tn
      return norm(value) === norm(target)
    }
    case 'notEquals':
      return !matchesRule(value, { ...rule, operator: 'equals' })
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const n = toNumber(value)
      const tn = toNumber(target)
      if (n === null || tn === null) return false
      if (operator === 'gt') return n > tn
      if (operator === 'gte') return n >= tn
      if (operator === 'lt') return n < tn
      return n <= tn
    }
    case 'between': {
      const [minRaw, maxRaw] = Array.isArray(target) ? target : [null, null]
      const n = toNumber(value)
      if (n === null) return false
      const min = toNumber(minRaw)
      const max = toNumber(maxRaw)
      if (min !== null && n < min) return false
      if (max !== null && n > max) return false
      return true
    }
    case 'dateBetween': {
      const [fromRaw, toRaw] = Array.isArray(target) ? target : [null, null]
      const t = toTime(value)
      if (t === null) return false
      const from = toTime(fromRaw)
      // El "hasta" es inclusivo: se extiende al final del día.
      const to = toTime(toRaw)
      if (from !== null && t < from) return false
      if (to !== null && t > to + 86_399_999) return false
      return true
    }
    case 'in': {
      const list = Array.isArray(target) ? target : [target]
      if (list.length === 0) return true
      return list.some((x) => norm(x) === norm(value))
    }
    default:
      return true
  }
}

/* --- índice de búsqueda -------------------------------------------- */

const TEXT_OPERATORS = new Set<FilterOperator>([
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
])

/**
 * Cachea las cadenas normalizadas. `normalize('NFD')` por celda y por
 * pulsación es lo que hace lenta la búsqueda global; aquí se paga una vez.
 * Todo se construye **a demanda**: si nadie busca, no cuesta nada.
 */
export interface SearchIndex {
  /** Todas las columnas de la fila concatenadas y normalizadas. */
  haystack: (rowIndex: number) => string
  /** Valores normalizados de una columna. `null` si la columna no existe. */
  column: (columnId: string) => string[] | null
}

export function createSearchIndex<T>(rows: T[], columns: ColumnDef<T>[]): SearchIndex {
  let all: string[] | null = null
  const perColumn = new Map<string, string[] | null>()

  return {
    haystack(rowIndex) {
      if (!all) {
        const searchable = columns.filter((c) => c.accessorKey || c.accessorFn)
        all = new Array<string>(rows.length)
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          let acc = ''
          for (const column of searchable) {
            acc += norm(toPlainText(getCellValue(row, column), row, column))
            acc += ' '
          }
          all[i] = acc
        }
      }
      return all[rowIndex]
    },
    column(columnId) {
      if (perColumn.has(columnId)) return perColumn.get(columnId)!
      const column = columns.find((c) => c.id === columnId)
      if (!column) {
        perColumn.set(columnId, null)
        return null
      }
      const values = new Array<string>(rows.length)
      for (let i = 0; i < rows.length; i++) values[i] = norm(getCellValue(rows[i], column))
      perColumn.set(columnId, values)
      return values
    },
  }
}

function matchesNormalized(value: string, needle: string, operator: FilterOperator): boolean {
  switch (operator) {
    case 'contains':
      return value.includes(needle)
    case 'notContains':
      return !value.includes(needle)
    case 'startsWith':
      return value.startsWith(needle)
    default:
      return value.endsWith(needle)
  }
}

export function filterRows<T>(
  rows: T[],
  filters: FilterRule[],
  globalSearch: string,
  columns: ColumnDef<T>[],
  index?: SearchIndex,
): T[] {
  const active = filters.filter(isFilterActive)
  const q = norm(globalSearch)
  if (active.length === 0 && !q) return rows

  const byId = new Map(columns.map((c) => [c.id, c]))
  const searchable = columns.filter((c) => c.accessorKey || c.accessorFn)

  // Trabajo por regla que no depende de la fila: fuera del bucle.
  const prepared = active.map((rule) => {
    const column = byId.get(rule.id)
    const fastPath = Boolean(column) && !column!.filterFn && TEXT_OPERATORS.has(rule.operator)
    return {
      rule,
      column,
      values: fastPath ? (index?.column(rule.id) ?? null) : null,
      needle: fastPath ? norm(rule.value) : '',
    }
  })

  const out: T[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let keep = true

    for (const p of prepared) {
      if (!p.column) continue
      keep = p.values
        ? matchesNormalized(p.values[i], p.needle, p.rule.operator)
        : p.column.filterFn
          ? p.column.filterFn(row, p.rule)
          : matchesRule(getCellValue(row, p.column), p.rule)
      if (!keep) break
    }
    if (!keep) continue

    if (q) {
      if (index) {
        if (!index.haystack(i).includes(q)) continue
      } else {
        const hit = searchable.some((c) =>
          norm(toPlainText(getCellValue(row, c), row, c)).includes(q),
        )
        if (!hit) continue
      }
    }
    out.push(row)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Varios                                                              */
/* ------------------------------------------------------------------ */

/** Opciones únicas de una columna, ordenadas por etiqueta (filtros select). */
export function deriveFacets<T>(rows: T[], column: ColumnDef<T>): SelectOption[] {
  const seen = new Map<string, string>()
  for (const row of rows) {
    const raw = getCellValue(row, column)
    if (raw === null || raw === undefined || raw === '') continue
    const value = String(raw)
    if (!seen.has(value)) seen.set(value, toPlainText(raw, row, column) || value)
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Operador por defecto según el tipo de filtro. */
export function defaultOperatorFor(kind: string): FilterOperator {
  switch (kind) {
    case 'number':
      return 'equals'
    case 'select':
      return 'in'
    case 'date':
      return 'dateBetween'
    case 'boolean':
      return 'equals'
    default:
      return 'contains'
  }
}

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/** `{ colorAccent: 'red' }` → `{ '--dt-color-accent': 'red' }` */
export function themeToCssVars(theme?: ThemeTokens): Record<string, string> {
  if (!theme) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(theme)) {
    if (value == null) continue
    out[`--dt-${camelToKebab(key)}`] = String(value)
  }
  return out
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

export const DEFAULT_LABELS: TableLabels = {
  search: 'Buscar…',
  columns: 'Columnas',
  density: 'Densidad',
  densityCompact: 'Compacta',
  densityNormal: 'Normal',
  densityComfortable: 'Amplia',
  export: 'Exportar',
  exportCsvPage: 'CSV — página actual',
  exportCsvAll: 'CSV — todos los resultados',
  exportPdfPage: 'PDF — página actual',
  exportPdfAll: 'PDF — todos los resultados',
  reset: 'Restablecer',
  empty: 'Sin resultados',
  loading: 'Cargando…',
  errorRetry: 'Reintentar',
  rowsPerPage: 'Filas por página',
  of: 'de',
  selected: 'seleccionadas',
  showAll: 'Mostrar todas',
  hideAll: 'Ocultar todas',
  pinLeft: 'Fijar a la izquierda',
  pinRight: 'Fijar a la derecha',
  unpin: 'Quitar fijado',
  sortAsc: 'Ordenar ascendente',
  sortDesc: 'Ordenar descendente',
  clearSort: 'Quitar del orden',
  sortOnly: 'Ordenar solo por esta',
  sortOrder: 'Orden aplicado',
  clearAllSorts: 'Limpiar orden',
  sortHint: 'Clic para añadir al orden múltiple. Shift + clic para ordenar solo por esta columna.',
  filterAll: 'Todos',
  page: 'Página',
  first: 'Primera página',
  prev: 'Página anterior',
  next: 'Página siguiente',
  last: 'Última página',
  selectAll: 'Seleccionar todas las filas de la página',
  selectRow: 'Seleccionar fila',
  dragHint: 'Arrastra para reordenar. Ctrl + ←/→ para mover con teclado.',
}
