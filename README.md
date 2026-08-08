# DataTable — tabla React 100 % configurable

React 19 + Vite 8 + TypeScript. Sin dependencias de UI: solo `jspdf` + `jspdf-autotable`,
y ambas se cargan de forma diferida (solo al exportar a PDF).

```bash
npm install
npm run dev
```

## Qué trae

| Feature | Detalle |
|---|---|
| Reordenar columnas | Drag & drop HTML5 nativo en la cabecera, indicador de inserción antes/después. También `Ctrl + ←/→` con la cabecera enfocada, y arrastre o botones ↑/↓ en el panel de columnas. |
| Título + subtítulo | `header` y `subHeader` por columna, o `renderHeader` para control total. |
| Filtro por columna | `text`, `number`, `select` (multi, con facetas), `date` (rango), `boolean`, `none`. Selector de operador (`contiene`, `=`, `≥`, `entre`, …). Debounce de 300 ms. |
| Orden múltiple | **Acumulativo por defecto**: cada clic añade la columna sin perder las anteriores y cicla asc → desc → fuera del orden. El badge numérico de la cabecera es **la posición en el `ORDER BY`**. Ver [Orden múltiple](#orden-múltiple). |
| Redimensionar | Arrastre del borde derecho, con `minWidth`/`maxWidth`. Doble clic restaura el ancho original. |
| Fijar columnas | `pin: 'left' \| 'right'` + menú por columna. Sticky con sombra de borde. |
| Visibilidad | Panel de columnas con checkbox, mostrar/ocultar todas. |
| Densidad | Compacta / Normal / Amplia (solo cambia métricas, nunca color). |
| Selección | Checkbox por fila + "seleccionar página" con estado indeterminado. Controlado u opcional. |
| Filas expandibles | `renderExpanded` añade una columna de expansor. |
| Virtualización | Solo pinta las filas visibles (altura medida del DOM, no hardcodeada). |
| Paginación | Client o server, tamaños configurables. |
| Export | CSV (BOM UTF-8, escapado anti CSV-injection) y PDF (jsPDF + autoTable), en ámbito **página actual** o **todos los resultados**. |
| Persistencia | Orden, anchos, pins, visibilidad, orden múltiple, filtros, densidad y `pageSize` en `localStorage` por `tableId`, con versionado de esquema. |
| Tema | Tokens CSS `--dt-*`, claro/oscuro automático y explícito, override por instancia con `theme={{ … }}`. |
| A11y | `aria-sort`, roles de menú/listbox, `aria-label` en todos los controles, foco visible, `prefers-reduced-motion`. |

## Uso mínimo

```tsx
import { DataTable, type ColumnDef } from './components/DataTable'

type User = { id: string; name: string; age: number }

const columns: ColumnDef<User>[] = [
  { id: 'name', header: 'Nombre', accessorKey: 'name', filter: { kind: 'text' } },
  { id: 'age', header: 'Edad', accessorKey: 'age', align: 'right', filter: { kind: 'number' } },
]

<DataTable<User>
  tableId="usuarios"
  columns={columns}
  rows={users}            // memoiza este array
  getRowId={(row) => row.id}
/>
```

## Orden múltiple

El estado es un **array ordenado**, y esa posición es la prioridad:

```ts
sorts: [{ id: 'department', dir: 'asc' }, { id: 'salary', dir: 'desc' }]
//  →   ORDER BY department ASC, salary DESC
```

Interacción (modo `accumulate`, el de por defecto):

| Acción | Efecto |
|---|---|
| Clic en una cabecera nueva | La **añade al final** del orden, en `asc`. Las anteriores se mantienen. |
| Clic en una ya ordenada | `asc → desc → fuera del orden`. Cambiar de dirección **no altera su posición**. |
| **Shift/⌘/Ctrl + clic** | Ordena **solo** por esa columna (descarta el resto). |
| Menú de la columna | `Ordenar asc/desc` acumula · `Ordenar solo por esta` · `Quitar del orden`. |

Con `multiSortMode="modifier"` se invierte: el clic simple reemplaza y el modificador acumula
(el comportamiento clásico). Con `enableMultiSort={false}` solo hay orden simple.

La **barra "Orden aplicado"** (encima de la cabecera) hace visible y manipulable ese array:
un chip numerado por columna, con `‹ ›` para cambiar su prioridad, clic para invertir la
dirección y `×` para sacarla. Se oculta con `showSortSummary={false}`.

## Modelo de datos: un solo adapter, dos modos

La tabla no sabe de dónde vienen los datos. Emite un `QueryState` y espera un `QueryResult`:

```ts
interface QueryState {
  page: number
  pageSize: number          // 0 = sin paginar
  sorts: { id: string; dir: 'asc' | 'desc' }[]   // orden de aplicación preservado
  filters: { id: string; operator: FilterOperator; value: unknown }[]
  globalSearch: string
}

interface QueryResult<T> { rows: T[]; total: number }
```

**Modo client** — pasa `rows` y la tabla monta un `createClientDataSource` internamente
(filtra, ordena y pagina en memoria; las facetas de los filtros `select` se derivan solas).

**Modo server** — pasa `dataSource`:

```tsx
const source = useMemo(
  () =>
    createServerDataSource<User>({
      fetch: async (query, signal) => {
        const res = await fetch(`/api/users?${queryToSearchParams(query)}`, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() // { rows, total }
      },
      // las opciones de los filtros `select` las da el backend
      facets: { country: [{ value: 'ES', label: 'España' }] },
    }),
  [],
)

<DataTable dataSource={source} … />
```

`queryToSearchParams` y `serializeSorts` son helpers opcionales para un backend REST típico.
Las peticiones obsoletas se cancelan con `AbortController`; el estado de carga y el de error
(con botón de reintento) están incluidos.

> `dataSource` y `rows` deben ser estables (`useMemo`). Si necesitas forzar un refetch sin
> cambiar la identidad del objeto, usa `dataSourceKey`.

## Las tres capas de customización

### 1. Design tokens (CSS)

Todo color y toda medida sale de una variable `--dt-*` definida en
[`tokens.css`](src/components/DataTable/tokens.css). Tres niveles, de menor a mayor prioridad:

```css
/* global, en tu app */
:root { --dt-color-accent: #059669; --dt-radius: 10px; }

/* por subárbol */
[data-dt-theme="dark"] { … }   /* también respeta prefers-color-scheme */
```

```tsx
/* por instancia, tipado */
<DataTable theme={{ colorAccent: '#e11d48', radius: '20px', borderWidth: '2px' }} />
```

`theme` es un objeto tipado (`ThemeTokens`): cada clave camelCase se inyecta como
`--dt-kebab-case` en el elemento raíz. El autocompletado te dice qué tokens existen.

### 2. Slots y clases

```tsx
<DataTable
  classNames={{ root, toolbar, scroller, table, thead, headerRow, headerCell,
                filterRow, filterCell, tbody, row, cell, footer }}
  slots={{
    empty: <MiEstadoVacio />,
    loading: <MiSkeleton />,
    error: (err, retry) => <MiError error={err} onRetry={retry} />,
    pagination: (ctx) => <MiPaginador {...ctx} />,
    sortIndicator: (dir, index) => <MiIcono dir={dir} n={index} />,
  }}
  labels={{ search: 'Search…', empty: 'No results' }}   // i18n completa
/>
```

### 3. Render props por columna

```ts
{
  id: 'status',
  header: 'Estado',
  subHeader: 'Ciclo de vida',
  accessorFn: (row) => row.status,        // o accessorKey
  renderCell: ({ value, row }) => <Chip value={value} />,
  renderHeader: ({ sortDir, sortIndex }) => …,
  formatValue: (v) => LABELS[v],           // usado por CSV/PDF y por la celda por defecto
  sortFn: (a, b) => …,                     // comparador custom (modo client)
  filterFn: (row, rule) => …,              // predicado custom (modo client)
  filter: { kind: 'select', render: (ctx) => <MiFiltro {...ctx} /> },  // control propio
  cellClassName: ({ value }) => (value < 0 ? 'negativo' : undefined),
  cellStyle: { fontVariantNumeric: 'tabular-nums' },
}
```

## Arquitectura de estado y rendimiento

Tres niveles según la frecuencia de cambio:

1. **Transitorio (60 fps) → CSS, no React.** Los anchos de columna son CSS vars
   (`--dt-w-<id>`). Durante el resize se escribe la variable directamente en el
   raíz: `colgroup`, offsets sticky y `min-width` de la tabla los rederiva el
   navegador vía `calc(var(...))`. **Cero renders por `pointermove`**; un único
   commit al soltar.
2. **Confirmado → reducer + store con selectores.** Un store mínimo
   (`useSyncExternalStore`, mismo contrato que Zustand vanilla, cero deps) con
   acciones tipadas. Cada componente se suscribe a su porción por selector:
   marcar un checkbox re-renderiza **1 fila**; la toolbar solo reacciona a lo
   que pinta. Nada de prop drilling: `dispatch` y la config llegan por contexto.
3. **Derivado → pipeline en capas memoizadas** (modo client):
   `índice de búsqueda → filtrar → ordenar → slice`. Cambiar de página solo
   ejecuta el slice; cambiar el orden no re-filtra. El orden usa claves
   precalculadas (transformación de Schwartz) y la búsqueda un índice
   normalizado que se construye una vez por dataset, de forma perezosa.

Medido (Node 24, mediana):

| operación | 50 000 filas antes → ahora | 200 000 antes → ahora |
|---|---|---|
| ordenar (2 criterios) | 230 → **45 ms** | 1 322 → **198 ms** |
| búsqueda global (índice caliente) | 377 → **2,7 ms** | 1 463 → **11 ms** |
| cambiar de página | 272 → **~0 ms** | 1 633 → **~0 ms** |

En el DOM: toggle de un checkbox = 8 mutaciones (antes, cuerpo completo);
30 `pointermove` de resize = **0 mutaciones** en `tbody`.

El export "todos los resultados" en modo server **nunca pide todo de golpe**:
`fetchAllPaginated()` recorre lotes de 500 con tope de 50 000 filas.

```
src/components/DataTable/
├── DataTable.tsx           # orquestador: pipeline, layout, contextos, virtualización
├── state.ts                # TableState + reducer con acciones tipadas
├── store.ts                # store con selectores (useSyncExternalStore)
├── context.ts              # ConfigContext (props) / DataContext (resultados)
├── layout.ts               # columnas → CSS vars, offsets sticky en calc()
├── constants.ts            # anchos por defecto, debounce, densidades
├── DataTable.module.css    # CSS Modules con nesting nativo, 100 % tokens
├── tokens.css              # design tokens --dt-*, claro/oscuro, densidades
├── types.ts                # ColumnDef, DataSource, TableState, ThemeTokens, slots…
├── utils.ts                # motor: filtros, orden con claves, índice de búsqueda
├── dataSources.ts          # createClient/ServerDataSource, fetchAllPaginated
├── exporters.ts            # CSV + PDF (import dinámico de jspdf)
├── hooks.ts                # debounce, persistencia, virtualización, useDataSource
├── icons.tsx               # SVG inline, sin dependencias
├── portalContext.ts        # host de popovers (escapa de overflow y stacking)
└── parts/
    ├── HeaderCell.tsx      # sort, resize (CSS var), DnD, menú — memo + selectores
    ├── BodyRow.tsx         # fila memoizada, suscrita solo a SU selección/expansión
    ├── HeaderStructural.tsx# select-all + celdas de filtro
    ├── SortBar.tsx         # orden múltiple numerado y reordenable
    ├── FilterControl.tsx   # text / number / select / date / boolean
    ├── Popover.tsx         # portal + posicionado con flip
    ├── Toolbar.tsx         # búsqueda, columnas, densidad, export, reset
    └── Footer.tsx          # paginación
```

> **Importante**: memoiza `getRowId`, `renderCell`, `renderRowActions`,
> `renderExpanded` y `columns` en el consumidor (`useCallback`/`useMemo` o
> módulo). Las filas los reciben por contexto: si cambian de identidad en cada
> render del padre, todas las filas se re-renderizan.

## Props principales

| Prop | Tipo | Por defecto |
|---|---|---|
| `columns` | `ColumnDef<T>[]` | — |
| `rows` / `dataSource` | `T[]` / `DataSource<T>` | — |
| `getRowId` | `(row, i) => string` | — |
| `tableId` / `persist` / `persistVersion` | `string` / `boolean` / `number` | — / `true` / `1` |
| `enableColumnReorder` · `Resize` · `Pinning` · `Visibility` | `boolean` | `true` |
| `enableMultiSort` · `GlobalSearch` · `DensityToggle` · `Export` · `Pagination` | `boolean` | `true` |
| `multiSortMode` | `'accumulate' \| 'modifier'` | `'accumulate'` |
| `showSortSummary` | `boolean` | `true` |
| `enableRowSelection` · `enableVirtualization` · `stripedRows` | `boolean` | `false` |
| `stickyHeader` | `boolean` | `true` |
| `virtualizationThreshold` / `overscan` | `number` | `80` / `8` |
| `pageSizeOptions` | `number[]` | `[10, 25, 50, 100]` |
| `height` | `number \| string` | auto (`max-height: 70vh`) |
| `theme` / `classNames` / `slots` / `labels` | ver arriba | — |
| `exportFileName` / `pdfTitle` / `pdfOrientation` | `string` | `'tabla'` / — / `'landscape'` |

## Demo

`src/App.tsx` monta 5 000 empleados generados con un PRNG determinista y permite alternar
modo client/server, cuatro presets de tema (incluido uno brutalista que solo cambia tokens),
claro/oscuro, virtualización y zebra, además de forzar un error del servidor para ver el
estado de fallo.
