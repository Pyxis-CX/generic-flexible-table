# list-dragable — monorepo

| Ruta | Qué es |
|---|---|
| [`packages/datatable`](packages/datatable) | **@list-dragable/datatable** — la biblioteca (React 19, ESM, tsdown) |
| [`apps/playground`](apps/playground) | Demo Vite que consume el paquete construido |
| [`apps/docs`](apps/docs) | Sitio de documentación (Nextra 4, export estático) |

## Comandos

```bash
pnpm install
pnpm build        # construye la biblioteca (tsdown + styles.css + publint)
pnpm test         # unit + types + browser (Chromium real)
pnpm dev          # playground en localhost:5173
pnpm docs:dev     # docs en localhost:3000
pnpm changeset    # añade un changeset a tu PR
```

## Release

Merge a `main` con changesets → el workflow abre el PR **Version Packages** →
al mergearlo se publica a npm vía **trusted publishing OIDC** (sin tokens) con
provenance. Ver [.github/workflows/release.yml](.github/workflows/release.yml)
para el setup inicial (primer publish manual + configurar trusted publisher).
