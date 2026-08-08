import nextra from 'nextra'

const withNextra = nextra({})

export default withNextra({
  output: 'export',
  images: { unoptimized: true },
  // GitHub Pages sirve bajo /<repo>/; en local queda vacío.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
})
