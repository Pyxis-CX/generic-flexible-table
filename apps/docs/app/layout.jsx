import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: '@pyxis-cx/generic-flexible-table',
    template: '%s — @pyxis-cx/generic-flexible-table',
  },
  description:
    'Tabla React 100 % configurable: multi-orden numerado, filtros por columna, columnas fijadas, virtualización, export CSV/PDF y theming por design tokens.',
}

export default async function RootLayout({ children }) {
  return (
    <html lang="es" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={
            <Navbar
              logo={<b>⌗ datatable</b>}
              projectLink="https://github.com/Pyxis-CX/generic-flexible-table"
            />
          }
          footer={<Footer>MIT — @pyxis-cx/generic-flexible-table</Footer>}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/Pyxis-CX/generic-flexible-table/tree/main/apps/docs"
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
