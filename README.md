# generic-flexible-table — monorepo

| Ruta | Qué es |
|---|---|
| [`packages/datatable`](packages/datatable) | **@pyxis-cx/generic-flexible-table** — la biblioteca (React 19, ESM, tsdown) |
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
al mergearlo se publica en **GitHub Packages** con el `GITHUB_TOKEN` del
propio workflow (sin secrets manuales).

Instalación para consumidores (GitHub Packages requiere auth):

```ini
# .npmrc
@pyxis-cx:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```
