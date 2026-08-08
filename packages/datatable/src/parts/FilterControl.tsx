'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import s from '../DataTable.module.css'
import { Popover } from './Popover'
import { IconChevronDown, IconX } from '../icons'
import { useDebouncedValue } from '../hooks'
import { defaultOperatorFor, isFilterActive } from '../utils'
import type { ReactNode } from 'react'
import type { ColumnDef, FilterOperator, FilterRule, SelectOption, TableLabels } from '../types'

const OPERATOR_SYMBOL: Partial<Record<FilterOperator, string>> = {
  contains: '∋',
  notContains: '∌',
  equals: '=',
  notEquals: '≠',
  startsWith: 'A‥',
  endsWith: '‥Z',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: '↔',
}

const OPERATOR_LABEL: Partial<Record<FilterOperator, string>> = {
  contains: 'contiene',
  notContains: 'no contiene',
  equals: 'igual a',
  notEquals: 'distinto de',
  startsWith: 'empieza por',
  endsWith: 'termina en',
  gt: 'mayor que',
  gte: 'mayor o igual',
  lt: 'menor que',
  lte: 'menor o igual',
  between: 'entre',
}

export interface FilterControlProps<T> {
  column: ColumnDef<T>
  rule: FilterRule | undefined
  setRule: (rule: FilterRule | undefined) => void
  labels: TableLabels
  facets: SelectOption[]
  debounceMs: number
}

export function FilterControl<T>({ column, rule, setRule, labels, facets, debounceMs }: FilterControlProps<T>): ReactNode {
  const config = column.filter
  if (!config || config.kind === 'none') return null
  if (config.render) return <>{config.render({ column, rule, setRule })}</>

  switch (config.kind) {
    case 'select':
      return <SelectFilter column={column} rule={rule} setRule={setRule} labels={labels} facets={facets} />
    case 'boolean':
      return <BooleanFilter column={column} rule={rule} setRule={setRule} labels={labels} />
    case 'date':
      return <DateFilter column={column} rule={rule} setRule={setRule} debounceMs={debounceMs} />
    case 'number':
      return <NumberFilter column={column} rule={rule} setRule={setRule} debounceMs={debounceMs} />
    default:
      return <TextFilter column={column} rule={rule} setRule={setRule} debounceMs={debounceMs} />
  }
}

/* ------------------------------------------------------------------ */
/* Draft + debounce compartido por los filtros con input libre          */
/* ------------------------------------------------------------------ */

function useDraft<V>(external: V, emit: (value: V) => void, debounceMs: number) {
  const [draft, setDraft] = useState<V>(external)
  const emittedRef = useRef<V>(external)
  const debounced = useDebouncedValue(draft, debounceMs)

  // Reset externo (botón "Restablecer", estado persistido, etc.)
  const externalKey = JSON.stringify(external ?? null)
  const emittedKey = JSON.stringify(emittedRef.current ?? null)
  useEffect(() => {
    if (externalKey !== emittedKey) {
      emittedRef.current = external
      setDraft(external)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalKey])

  useEffect(() => {
    if (JSON.stringify(debounced ?? null) === JSON.stringify(emittedRef.current ?? null)) return
    emittedRef.current = debounced
    emit(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debounced ?? null)])

  return [draft, setDraft] as const
}

function operatorsFor<T>(column: ColumnDef<T>, fallback: FilterOperator[]): FilterOperator[] {
  return column.filter?.operators ?? fallback
}

/** Nombre legible de la columna para etiquetas ARIA. */
function columnLabel<T>(column: ColumnDef<T>): string {
  if (typeof column.header === 'string') return column.header
  return column.exportHeader ?? column.id
}

function OperatorSelect({
  value,
  options,
  onChange,
}: {
  value: FilterOperator
  options: FilterOperator[]
  onChange: (op: FilterOperator) => void
}) {
  if (options.length < 2) return null
  return (
    <select
      className={s.opSelect}
      value={value}
      onChange={(e) => onChange(e.target.value as FilterOperator)}
      title={OPERATOR_LABEL[value]}
      aria-label="Operador del filtro"
    >
      {options.map((op) => (
        <option key={op} value={op} title={OPERATOR_LABEL[op]}>
          {OPERATOR_SYMBOL[op] ?? op}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

function TextFilter<T>({
  column,
  rule,
  setRule,
  debounceMs,
}: Pick<FilterControlProps<T>, 'column' | 'rule' | 'setRule' | 'debounceMs'>) {
  const ops = operatorsFor(column, ['contains', 'equals', 'startsWith', 'endsWith', 'notContains'])
  const operator = rule?.operator ?? column.filter?.defaultOperator ?? ops[0]
  const [draft, setDraft] = useDraft<string>(
    (rule?.value as string) ?? '',
    (value) => setRule(value ? { id: column.id, operator, value } : undefined),
    debounceMs,
  )

  return (
    <>
      <OperatorSelect
        value={operator}
        options={ops}
        onChange={(op) => setRule(draft ? { id: column.id, operator: op, value: draft } : undefined)}
      />
      <input
        className={s.filterControl}
        data-filled={Boolean(draft)}
        type="search"
        value={draft}
        placeholder={column.filter?.placeholder ?? '…'}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={`Filtrar ${columnLabel(column)}`}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Número                                                              */
/* ------------------------------------------------------------------ */

function NumberFilter<T>({
  column,
  rule,
  setRule,
  debounceMs,
}: Pick<FilterControlProps<T>, 'column' | 'rule' | 'setRule' | 'debounceMs'>) {
  const ops = operatorsFor(column, ['equals', 'gte', 'lte', 'gt', 'lt', 'between'])
  const operator = rule?.operator ?? column.filter?.defaultOperator ?? ops[0]
  const isRange = operator === 'between'

  const external = isRange
    ? ((rule?.value as [string, string]) ?? ['', ''])
    : ((rule?.value as string) ?? '')

  const [draft, setDraft] = useDraft<string | [string, string]>(
    external,
    (value) => {
      const filled = Array.isArray(value) ? value.some(Boolean) : Boolean(value)
      setRule(filled ? { id: column.id, operator, value } : undefined)
    },
    debounceMs,
  )

  const changeOperator = (op: FilterOperator) => {
    if (op === 'between') {
      setDraft(['', ''])
      setRule(undefined)
      return
    }
    // Al salir de "entre" el valor de rango no es reutilizable.
    const kept = Array.isArray(draft) ? '' : draft
    setDraft(kept)
    setRule(kept ? { id: column.id, operator: op, value: kept } : undefined)
  }

  return (
    <>
      <OperatorSelect value={operator} options={ops} onChange={changeOperator} />
      {isRange ? (
        <>
          <input
            className={s.filterControl}
            type="number"
            value={(draft as [string, string])[0]}
            placeholder="mín"
            onChange={(e) => setDraft([e.target.value, (draft as [string, string])[1]])}
            aria-label="Mínimo"
          />
          <input
            className={s.filterControl}
            type="number"
            value={(draft as [string, string])[1]}
            placeholder="máx"
            onChange={(e) => setDraft([(draft as [string, string])[0], e.target.value])}
            aria-label="Máximo"
          />
        </>
      ) : (
        <input
          className={s.filterControl}
          data-filled={Boolean(draft)}
          type="number"
          value={draft as string}
          placeholder={column.filter?.placeholder ?? '…'}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Filtrar ${columnLabel(column)}`}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Fecha (rango)                                                       */
/* ------------------------------------------------------------------ */

function DateFilter<T>({
  column,
  rule,
  setRule,
  debounceMs,
}: Pick<FilterControlProps<T>, 'column' | 'rule' | 'setRule' | 'debounceMs'>) {
  const [draft, setDraft] = useDraft<[string, string]>(
    (rule?.value as [string, string]) ?? ['', ''],
    (value) =>
      setRule(
        value.some(Boolean) ? { id: column.id, operator: 'dateBetween', value } : undefined,
      ),
    debounceMs,
  )

  return (
    <>
      <input
        className={s.filterControl}
        data-filled={Boolean(draft[0])}
        type="date"
        value={draft[0]}
        onChange={(e) => setDraft([e.target.value, draft[1]])}
        aria-label="Desde"
      />
      <input
        className={s.filterControl}
        data-filled={Boolean(draft[1])}
        type="date"
        value={draft[1]}
        onChange={(e) => setDraft([draft[0], e.target.value])}
        aria-label="Hasta"
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Booleano                                                            */
/* ------------------------------------------------------------------ */

function BooleanFilter<T>({
  column,
  rule,
  setRule,
  labels,
}: Pick<FilterControlProps<T>, 'column' | 'rule' | 'setRule' | 'labels'>) {
  const value = rule ? String(rule.value) : ''
  const options = column.filter?.options ?? [
    { value: 'true', label: 'Sí' },
    { value: 'false', label: 'No' },
  ]
  return (
    <select
      className={s.filterControl}
      data-filled={Boolean(value)}
      value={value}
      onChange={(e) =>
        setRule(
          e.target.value
            ? { id: column.id, operator: 'equals', value: e.target.value === 'true' }
            : undefined,
        )
      }
      aria-label={`Filtrar ${columnLabel(column)}`}
    >
      <option value="">{labels.filterAll}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------ */
/* Select múltiple                                                     */
/* ------------------------------------------------------------------ */

function SelectFilter<T>({
  column,
  rule,
  setRule,
  labels,
  facets,
}: Pick<FilterControlProps<T>, 'column' | 'rule' | 'setRule' | 'labels' | 'facets'>) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  const options = column.filter?.options ?? facets
  const selected = Array.isArray(rule?.value) ? (rule.value as string[]) : []
  const active = rule ? isFilterActive(rule) : false

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    setRule(
      next.length
        ? {
            id: column.id,
            operator: column.filter?.defaultOperator ?? defaultOperatorFor('select'),
            value: next,
          }
        : undefined,
    )
  }

  const summary =
    selected.length === 0
      ? labels.filterAll
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} ${labels.selected}`

  return (
    <div className={s.popoverWrap} style={{ flex: 1, minWidth: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        className={s.multiTrigger}
        data-filled={active}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Filtrar ${columnLabel(column)}`}
      >
        <span>{summary}</span>
        {active ? (
          <IconX
            width={12}
            height={12}
            onClick={(e) => {
              e.stopPropagation()
              setRule(undefined)
            }}
          />
        ) : (
          <IconChevronDown width={12} height={12} />
        )}
      </button>
      <Popover
        anchorRef={triggerRef}
        open={open}
        onClose={close}
        align="start"
        matchAnchorWidth
        role="listbox"
        ariaMultiselectable
      >
          {options.length === 0 && <div className={s.popHeader}>Sin opciones</div>}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={s.popItem}
              role="option"
              aria-selected={selected.includes(o.value)}
              onClick={() => toggle(o.value)}
            >
              <input
                className={s.checkbox}
                type="checkbox"
                checked={selected.includes(o.value)}
                readOnly
                tabIndex={-1}
              />
              {o.label}
            </button>
          ))}
      </Popover>
    </div>
  )
}
