# @pyxis-cx/generic-flexible-table

## 0.3.0

### Minor Changes

- ee0b7da: Los títulos de columna ya **no se truncan por defecto**: envuelven y la
  cabecera crece (la fila de filtros sticky sigue la altura real medida vía
  `--dt-measured-header-h`). Truncar es opt-in — `truncateHeaders` global o
  `truncateHeader` por columna — y entonces la celda muestra tooltip nativo con
  el texto completo (`headerTooltip` propio sigue ganando).

## 0.2.0

### Minor Changes

- f63e4b4: Nuevo flag `enableColumnFilters` (default `true`): apagado, la fila de filtros
  por columna desaparece Y las reglas existentes dejan de aplicarse (pipeline,
  query del server y export incluidos). El control por columna sigue igual:
  `filter` omitido o `kind: 'none'`.

## 0.1.0

### Minor Changes

- 6ebd786: Navegación de teclado ARIA grid (roving tabindex, flechas/Home/End dir-aware,
  Enter acciona el control de la celda, cero renders por pulsación) y
  `PersistenceAdapter` inyectable (localStorage por defecto; soporta adapters
  asíncronos con hidratación segura que no pisa el estado guardado).
- cc1edb0: Modo controlado (`state` + `onStateChange` + `buildTableState`), soporte RTL
  completo (propiedades lógicas, resize y drag & drop dir-aware, sombras de pin
  espejadas) y publicación precompilada con React Compiler.
- ba747c2: Cursor pagination (`createCursorDataSource` con caché de cursores y total
  estimado), pipeline completo en Web Worker (`createWorkerDataSource`: las
  filas viajan una vez, cada query solo mueve la página) y virtualización de
  columnas (`enableColumnVirtualization`, ventana horizontal con fijadas
  siempre visibles).
