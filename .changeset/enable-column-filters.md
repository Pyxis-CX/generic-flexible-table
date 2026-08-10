---
'@pyxis-cx/generic-flexible-table': minor
---

Nuevo flag `enableColumnFilters` (default `true`): apagado, la fila de filtros
por columna desaparece Y las reglas existentes dejan de aplicarse (pipeline,
query del server y export incluidos). El control por columna sigue igual:
`filter` omitido o `kind: 'none'`.
