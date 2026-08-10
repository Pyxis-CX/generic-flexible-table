# @pyxis-cx/generic-flexible-table

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
