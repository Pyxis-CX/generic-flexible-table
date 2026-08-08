import { useCallback, useEffect, useMemo, useState } from 'react'

import { DataTable, createServerDataSource } from './components/DataTable'
import type { ThemeTokens } from './components/DataTable'
import { employeeColumns } from './demo/columns'
import { STATUS_LABELS, generateEmployees, type Employee } from './demo/data'
import { createMockApi } from './demo/mockApi'
import d from './demo/demo.module.css'

type Mode = 'client' | 'server'

const BRANDS: Record<string, { label: string; swatch: string; tokens: ThemeTokens }> = {
  indigo: {
    label: 'Indigo',
    swatch: '#4f46e5',
    tokens: {},
  },
  emerald: {
    label: 'Esmeralda',
    swatch: '#059669',
    tokens: {
      colorAccent: '#059669',
      colorAccentSoft: 'color-mix(in srgb, #059669 12%, transparent)',
      colorRowSelected: 'color-mix(in srgb, #059669 10%, transparent)',
      radius: '10px',
    },
  },
  sunset: {
    label: 'Atardecer',
    swatch: '#e11d48',
    tokens: {
      colorAccent: '#e11d48',
      colorAccentSoft: 'color-mix(in srgb, #e11d48 12%, transparent)',
      colorRowSelected: 'color-mix(in srgb, #e11d48 10%, transparent)',
      radius: '20px',
      headerFontWeight: '700',
    },
  },
  brutal: {
    label: 'Brutalista',
    swatch: '#111111',
    tokens: {
      colorAccent: '#111111',
      colorAccentSoft: '#ededed',
      colorBorder: '#111111',
      colorBorderStrong: '#111111',
      colorHeaderBg: '#111111',
      colorRowSelected: '#f5f5f5',
      radius: '0px',
      radiusSm: '0px',
      borderWidth: '2px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      shadowPin: '4px 0 0 -2px #111',
    },
  },
}

export default function App() {
  const [mode, setMode] = useState<Mode>('client')
  const [dark, setDark] = useState(false)
  const [brand, setBrand] = useState<keyof typeof BRANDS>('indigo')
  const [virtualized, setVirtualized] = useState(true)
  const [striped, setStriped] = useState(true)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    document.documentElement.dataset.dtTheme = dark ? 'dark' : 'light'
  }, [dark])

  const dataset = useMemo(() => generateEmployees(5000), [])

  // Identidades estables: las filas consumen esto por contexto, así que si
  // cambiaran en cada render de App, todas las filas se re-renderizarían.
  const getRowId = useCallback((row: Employee) => row.id, [])
  const initial = useMemo(() => ({ pageSize: 50 }), [])

  const renderRowActions = useCallback(
    (row: Employee) => (
      <>
        <button
          type="button"
          className={d.rowAction}
          title={`Editar ${row.name}`}
          onClick={(e) => {
            e.stopPropagation()
            window.alert(`Editar ${row.name}`)
          }}
        >
          ✎
        </button>
        <button
          type="button"
          className={d.rowAction}
          style={{ marginLeft: 6 }}
          title={`Copiar correo de ${row.name}`}
          onClick={(e) => {
            e.stopPropagation()
            void navigator.clipboard?.writeText(row.email)
          }}
        >
          ✉
        </button>
      </>
    ),
    [],
  )

  const renderExpanded = useCallback(
    (row: Employee) => (
      <dl className={d.expanded}>
        <div>
          <dt>Correo</dt>
          <dd>{row.email}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{STATUS_LABELS[row.status]}</dd>
        </div>
        <div>
          <dt>País</dt>
          <dd>{row.country}</dd>
        </div>
        <div>
          <dt>Modalidad</dt>
          <dd>{row.remote ? 'Remoto' : 'Presencial'}</dd>
        </div>
        <div>
          <dt>Proyectos activos</dt>
          <dd>{row.projects}</dd>
        </div>
      </dl>
    ),
    [],
  )
  const api = useMemo(() => createMockApi(dataset, employeeColumns), [dataset])
  // En modo server las opciones de los filtros `select` no se pueden derivar
  // del cliente: las entrega el backend (aquí, precalculadas del dataset).
  const serverSource = useMemo(() => {
    const facetOf = (key: keyof Employee) =>
      [...new Set(dataset.map((row) => String(row[key])))]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value }))

    return createServerDataSource<Employee>({
      fetch: api.fetch,
      facets: {
        department: facetOf('department'),
        role: facetOf('role'),
        country: facetOf('country'),
      },
    })
  }, [api, dataset])

  return (
    <div className={d.page}>
      <header className={d.header}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>DataTable configurable</h1>
          <p>
            Reordenar columnas arrastrando la cabecera, redimensionar por el borde derecho,
            filtro por columna, fijado, visibilidad, densidad, virtualización y export CSV/PDF.
            El orden es <b>acumulativo</b>: cada clic añade la columna y la numera según el
            orden de aplicación (<b>Shift + clic</b> ordena solo por esa). Todo el estado se
            guarda en <code>localStorage</code>.
          </p>
        </div>
      </header>

      <div className={d.shell}>
        <div className={d.controls}>
          <button
            type="button"
            className={d.control}
            data-active={mode === 'client'}
            onClick={() => setMode('client')}
          >
            Modo client (5 000 filas en memoria)
          </button>
          <button
            type="button"
            className={d.control}
            data-active={mode === 'server'}
            onClick={() => setMode('server')}
          >
            Modo server (fetch async)
          </button>

          <span style={{ flex: 1 }} />

          {Object.entries(BRANDS).map(([key, value]) => (
            <button
              key={key}
              type="button"
              className={d.control}
              data-active={brand === key}
              onClick={() => setBrand(key as keyof typeof BRANDS)}
            >
              <i className={d.swatch} style={{ background: value.swatch }} />
              {value.label}
            </button>
          ))}

          <button type="button" className={d.control} onClick={() => setDark((v) => !v)}>
            {dark ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
          <button
            type="button"
            className={d.control}
            data-active={virtualized}
            onClick={() => setVirtualized((v) => !v)}
          >
            Virtualización
          </button>
          <button
            type="button"
            className={d.control}
            data-active={striped}
            onClick={() => setStriped((v) => !v)}
          >
            Filas cebra
          </button>
          {mode === 'server' && (
            <button type="button" className={d.control} onClick={() => api.breakNext()}>
              Romper próxima petición
            </button>
          )}
        </div>

        <DataTable<Employee>
          key={mode}
          tableId={`empleados-${mode}`}
          columns={employeeColumns}
          rows={mode === 'client' ? dataset : undefined}
          dataSource={mode === 'server' ? serverSource : undefined}
          getRowId={getRowId}
          theme={BRANDS[brand].tokens}
          height={640}
          stripedRows={striped}
          enableVirtualization={virtualized}
          enableRowSelection
          selectedRowIds={selected}
          onSelectionChange={setSelected}
          initialState={initial}
          pageSizeOptions={[10, 25, 50, 100, 250]}
          exportFileName="empleados"
          pdfTitle="Listado de empleados"
          renderRowActions={renderRowActions}
          renderExpanded={renderExpanded}
        />

        <p className={d.note}>
          {mode === 'server'
            ? 'La tabla emite { page, pageSize, sorts[], filters[], globalSearch } al adapter; el mock aplica latencia y cancela peticiones obsoletas con AbortController.'
            : 'Todo se resuelve en memoria sobre 5 000 filas. La virtualización solo pinta las filas visibles.'}{' '}
          Selección actual: <b>{selected.length}</b> filas.
        </p>
      </div>
    </div>
  )
}
