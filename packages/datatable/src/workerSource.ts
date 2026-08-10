import type { ColumnDef, DataSource, QueryResult, QueryState, SelectOption } from './types'
import { deriveFacets } from './utils'

/**
 * Pipeline en Web Worker para datasets client ENORMES (>100k filas): el sort
 * de 200k filas cuesta ~200 ms — en el worker, el main thread queda libre.
 *
 * Diseño: las filas viajan al worker UNA vez (al crear la fuente); cada
 * consulta envía solo el QueryState y recibe solo la página → el coste de
 * structured clone por interacción es mínimo.
 *
 * Restricciones (documentadas): las columnas deben usar `accessorKey` (las
 * funciones no cruzan al worker) y aplican los operadores integrados —
 * `sortFn`/`filterFn`/`accessorFn` se ignoran. Si las necesitas, usa el
 * pipeline síncrono normal.
 *
 * El worker es un Blob autocontenido: cero magia de bundlers, funciona en
 * Vite, Next y cualquier empaquetador sin configurar nada.
 */

/** Motor autocontenido que corre DENTRO del worker (subset del de utils.ts). */
const WORKER_CODE = String.raw`
'use strict';
let rows = [];
let keys = []; // accessorKeys por columna: { id, key }
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const normCache = new Map(); // columnId -> string[]

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const keyOf = (id) => { const c = keys.find((k) => k.id === id); return c ? c.key : null; };

function columnNorms(id) {
  let cached = normCache.get(id);
  if (cached) return cached;
  const key = keyOf(id);
  cached = rows.map((r) => norm(key ? r[key] : ''));
  normCache.set(id, cached);
  return cached;
}

const toNumber = (v) => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : Number(v); return Number.isNaN(n) ? null : n; };
const toTime = (v) => { if (v === null || v === undefined || v === '') return null; const t = new Date(String(v)).getTime(); return Number.isNaN(t) ? null : t; };

function matches(value, rule, normValue) {
  const t = rule.value;
  switch (rule.operator) {
    case 'contains': return normValue.includes(norm(t));
    case 'notContains': return !normValue.includes(norm(t));
    case 'startsWith': return normValue.startsWith(norm(t));
    case 'endsWith': return normValue.endsWith(norm(t));
    case 'equals': {
      if (typeof value === 'boolean') return value === (t === true || t === 'true');
      const n = toNumber(value), tn = toNumber(t);
      if (n !== null && tn !== null) return n === tn;
      return normValue === norm(t);
    }
    case 'notEquals': return !matches(value, { operator: 'equals', value: t }, normValue);
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const n = toNumber(value), tn = toNumber(t);
      if (n === null || tn === null) return false;
      if (rule.operator === 'gt') return n > tn;
      if (rule.operator === 'gte') return n >= tn;
      if (rule.operator === 'lt') return n < tn;
      return n <= tn;
    }
    case 'between': {
      const [a, b] = Array.isArray(t) ? t : [null, null];
      const n = toNumber(value); if (n === null) return false;
      const min = toNumber(a), max = toNumber(b);
      if (min !== null && n < min) return false;
      if (max !== null && n > max) return false;
      return true;
    }
    case 'dateBetween': {
      const [a, b] = Array.isArray(t) ? t : [null, null];
      const v = toTime(value); if (v === null) return false;
      const from = toTime(a), to = toTime(b);
      if (from !== null && v < from) return false;
      if (to !== null && v > to + 86399999) return false;
      return true;
    }
    case 'in': {
      const list = Array.isArray(t) ? t : [t];
      if (!list.length) return true;
      return list.some((x) => norm(x) === normValue);
    }
    default: return true;
  }
}

function isActive(rule) {
  const v = rule.value;
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) {
    if (rule.operator === 'between' || rule.operator === 'dateBetween') return v.some((x) => x !== null && x !== undefined && x !== '');
    return v.length > 0;
  }
  return true;
}

function query(q) {
  const active = q.filters.filter(isActive);
  const needle = norm(q.globalSearch);
  let idx = rows.map((_, i) => i);

  if (active.length || needle) {
    const norms = active.map((rule) => columnNorms(rule.id));
    const allNorms = needle ? keys.map((k) => columnNorms(k.id)) : [];
    idx = idx.filter((i) => {
      for (let f = 0; f < active.length; f++) {
        const rule = active[f];
        const key = keyOf(rule.id);
        if (!matches(key ? rows[i][key] : undefined, rule, norms[f][i])) return false;
      }
      if (needle && !allNorms.some((col) => col[i].includes(needle))) return false;
      return true;
    });
  }

  if (q.sorts.length) {
    const crits = q.sorts
      .map((rule) => ({ key: keyOf(rule.id), sign: rule.dir === 'asc' ? 1 : -1, id: rule.id }))
      .filter((c) => c.key);
    const numeric = crits.map((c) => rows.every((r) => { const v = r[c.key]; return v === null || v === undefined || v === '' || typeof v === 'number' || typeof v === 'boolean'; }));
    const strCols = crits.map((c, ci) => (numeric[ci] ? null : columnNorms(c.id)));
    idx = idx.slice().sort((a, b) => {
      for (let ci = 0; ci < crits.length; ci++) {
        const { key, sign } = crits[ci];
        const va = rows[a][key], vb = rows[b][key];
        const ea = va === null || va === undefined || va === '';
        const eb = vb === null || vb === undefined || vb === '';
        if (ea || eb) { if (ea && eb) continue; return ea ? 1 : -1; }
        let r;
        if (numeric[ci]) r = Number(va) - Number(vb);
        else r = collator.compare(strCols[ci][a], strCols[ci][b]);
        if (r !== 0) return r * sign;
      }
      return a - b;
    });
  }

  const total = idx.length;
  const page = q.pageSize > 0 ? idx.slice((q.page - 1) * q.pageSize, q.page * q.pageSize) : idx;
  return { rows: page.map((i) => rows[i]), total };
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    rows = msg.rows;
    keys = msg.keys;
    normCache.clear();
    self.postMessage({ type: 'ready', id: msg.id });
    return;
  }
  if (msg.type === 'query') {
    try {
      self.postMessage({ type: 'result', id: msg.id, ...query(msg.query) });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) });
    }
  }
};
`

export interface WorkerDataSource<T> extends DataSource<T> {
  /** Libera el worker. Llámalo al desmontar si la fuente ya no se usa. */
  terminate: () => void
}

/**
 * Crea un DataSource que resuelve filtro+orden+página en un Web Worker.
 * Las filas se transfieren UNA vez; cada interacción solo mueve el QueryState
 * y la página resultante.
 */
export function createWorkerDataSource<T extends Record<string, unknown>>(
  rows: T[],
  columns: ColumnDef<T>[],
): WorkerDataSource<T> {
  if (typeof Worker === 'undefined') {
    throw new Error('createWorkerDataSource requiere un entorno con Web Workers')
  }

  const blob = new Blob([WORKER_CODE], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  const worker = new Worker(url)
  URL.revokeObjectURL(url)

  let seq = 0
  const pending = new Map<
    number,
    { resolve: (r: QueryResult<T>) => void; reject: (e: Error) => void }
  >()

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as
      | { type: 'ready'; id: number }
      | { type: 'result'; id: number; rows: T[]; total: number }
      | { type: 'error'; id: number; message: string }
    const entry = pending.get(msg.id)
    if (!entry) return
    pending.delete(msg.id)
    if (msg.type === 'error') entry.reject(new Error(msg.message))
    else if (msg.type === 'result') entry.resolve({ rows: msg.rows, total: msg.total })
    else entry.resolve({ rows: [], total: 0 })
  }

  const post = (message: object): Promise<QueryResult<T>> =>
    new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      worker.postMessage({ ...message, id })
    })

  // init: las filas cruzan una única vez
  const ready = post({
    type: 'init',
    rows,
    keys: columns.filter((c) => c.accessorKey).map((c) => ({ id: c.id, key: c.accessorKey })),
  })

  return {
    mode: 'server', // async para la tabla: loading states incluidos
    async fetch(query: QueryState): Promise<QueryResult<T>> {
      await ready
      return post({ type: 'query', query })
    },
    getFacets: (columnId: string): SelectOption[] => {
      const column = columns.find((c) => c.id === columnId)
      return column ? deriveFacets(rows, column) : []
    },
    terminate: () => {
      worker.terminate()
      pending.clear()
    },
  }
}
