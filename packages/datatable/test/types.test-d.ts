import { describe, expectTypeOf, it } from 'vitest'
import type { ColumnDef, DataSource, QueryState, SortRule, TableState } from '../src/types'

interface User {
  id: string
  name: string
  age: number
  nested: { deep: boolean }
}

describe('API pública: genéricos', () => {
  it('accessorKey solo admite claves string del tipo de fila', () => {
    expectTypeOf<NonNullable<ColumnDef<User>['accessorKey']>>().toEqualTypeOf<
      'id' | 'name' | 'age' | 'nested'
    >()
    // @ts-expect-error — clave inexistente
    const bad: ColumnDef<User> = { id: 'x', header: 'x', accessorKey: 'inexistente' }
    void bad
  })

  it('accessorFn recibe la fila tipada', () => {
    expectTypeOf<NonNullable<ColumnDef<User>['accessorFn']>>().parameter(0).toEqualTypeOf<User>()
  })

  it('renderCell recibe el contexto tipado con la fila', () => {
    type Ctx = Parameters<NonNullable<ColumnDef<User>['renderCell']>>[0]
    expectTypeOf<Ctx['row']>().toEqualTypeOf<User>()
    expectTypeOf<Ctx['rowIndex']>().toEqualTypeOf<number>()
  })

  it('DataSource.fetch acepta sync o async', () => {
    type Ret = ReturnType<DataSource<User>['fetch']>
    expectTypeOf<Ret>().toEqualTypeOf<
      { rows: User[]; total: number } | Promise<{ rows: User[]; total: number }>
    >()
  })

  it('QueryState.sorts es un array ordenado de SortRule', () => {
    expectTypeOf<QueryState['sorts']>().toEqualTypeOf<SortRule[]>()
    expectTypeOf<SortRule['dir']>().toEqualTypeOf<'asc' | 'desc'>()
  })

  it('TableState es serializable (sin funciones)', () => {
    type Values = TableState[keyof TableState]
    expectTypeOf<Extract<Values, (...args: never[]) => unknown>>().toEqualTypeOf<never>()
  })
})
