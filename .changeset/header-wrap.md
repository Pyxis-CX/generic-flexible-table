---
'@pyxis-cx/generic-flexible-table': minor
---

Los títulos de columna ya **no se truncan por defecto**: envuelven y la
cabecera crece (la fila de filtros sticky sigue la altura real medida vía
`--dt-measured-header-h`). Truncar es opt-in — `truncateHeaders` global o
`truncateHeader` por columna — y entonces la celda muestra tooltip nativo con
el texto completo (`headerTooltip` propio sigue ganando).
