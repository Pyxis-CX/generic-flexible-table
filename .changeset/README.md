# Changesets

Cada PR que toque `packages/datatable` debe llevar un changeset:

```bash
pnpm changeset
```

Elige patch/minor/major y describe el cambio. Al mergear a main, el bot abre
el PR "Version Packages"; al mergear ese PR se publica a npm automáticamente.
