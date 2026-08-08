import { describe, expect, it } from 'vitest'
import { buildMatrix } from '../src/exporters'
import type { ColumnDef } from '../src/types'

interface Row {
  name: string
  amount: number
}

describe('buildMatrix', () => {
  const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Nombre', accessorKey: 'name' },
    {
      id: 'amount',
      header: 'Importe',
      accessorKey: 'amount',
      formatValue: (v) => `${v} €`,
    },
    { id: 'secret', header: 'Secreto', accessorKey: 'name', exportable: false },
    { id: 'jsx', header: undefined as never, exportHeader: 'Desde JSX', accessorKey: 'name' },
  ]

  const rows: Row[] = [
    { name: 'Ana', amount: 100 },
    { name: '=SUM(A1)', amount: 5 },
  ]

  it('usa formatValue, respeta exportable:false y exportHeader', () => {
    const { head, body } = buildMatrix(rows, columns)
    expect(head).toEqual(['Nombre', 'Importe', 'Desde JSX'])
    expect(body[0]).toEqual(['Ana', '100 €', 'Ana'])
  })

  it('el valor peligroso llega crudo a la matriz (el escape es del CSV writer)', () => {
    const { body } = buildMatrix(rows, columns)
    expect(body[1][0]).toBe('=SUM(A1)')
  })
})
