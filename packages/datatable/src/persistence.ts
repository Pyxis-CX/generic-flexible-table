import type { TableState } from './types'

/** Lo que se persiste: el estado confirmado menos lo efímero (página, búsqueda). */
export type PersistedTableState = Omit<TableState, 'page' | 'globalSearch'>

/**
 * Dónde guardar el estado de la tabla. El default es localStorage; implementa
 * esta interfaz para llevarlo a IndexedDB, a tu backend (vistas por usuario) o
 * a donde quieras. `read` puede ser síncrono o devolver una promesa: si es
 * asíncrono, la tabla arranca con el estado por defecto y aplica el guardado
 * al resolverse.
 */
export interface PersistenceAdapter {
  read: (
    key: string,
    version: number,
  ) => PersistedTableState | null | Promise<PersistedTableState | null>
  write: (key: string, version: number, state: PersistedTableState) => void | Promise<void>
  clear: (key: string) => void | Promise<void>
}

interface Envelope {
  v: number
  s: PersistedTableState
}

/** Adapter por defecto. Falla en silencio (modo privado, quota): la tabla sigue. */
export const localStorageAdapter: PersistenceAdapter = {
  read(key, version) {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Envelope
      return parsed.v === version ? parsed.s : null
    } catch {
      return null
    }
  },
  write(key, version, state) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify({ v: version, s: state } satisfies Envelope))
    } catch {
      /* noop */
    }
  },
  clear(key) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* noop */
    }
  },
}
