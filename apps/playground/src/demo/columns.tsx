import type { ColumnDef } from '@pyxis-cx/generic-flexible-table'
import d from './demo.module.css'
import { STATUS_LABELS, type Employee } from './data'

const money = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })

const STATUS_COLORS: Record<Employee['status'], string> = {
  active: '#16a34a',
  onboarding: '#2563eb',
  leave: '#d97706',
  offboarded: '#dc2626',
}

/** Color estable derivado del nombre: mismo empleado, mismo avatar. */
function hueFor(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 360
  return hash
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export const employeeColumns: ColumnDef<Employee>[] = [
  {
    id: 'id',
    header: 'ID',
    subHeader: 'Interno',
    accessorKey: 'id',
    width: 120,
    pin: 'left',
    filter: { kind: 'text', placeholder: 'EMP-…' },
  },
  {
    id: 'name',
    header: 'Empleado',
    subHeader: 'Nombre y correo',
    accessorKey: 'name',
    width: 250,
    pin: 'left',
    filter: { kind: 'text', placeholder: 'Nombre…' },
    renderCell: ({ value, row }) => (
      <div className={d.person}>
        <span
          className={d.avatar}
          style={{ background: `hsl(${hueFor(row.name)} 62% 48%)` }}
          aria-hidden
        >
          {initials(String(value))}
        </span>
        <span className={d.personText}>
          <b>{String(value)}</b>
          <small>{row.email}</small>
        </span>
      </div>
    ),
  },
  {
    id: 'department',
    header: 'Departamento',
    accessorKey: 'department',
    width: 160,
    filter: { kind: 'select' },
  },
  {
    id: 'role',
    header: 'Puesto',
    accessorKey: 'role',
    width: 150,
    filter: { kind: 'select' },
  },
  {
    id: 'status',
    header: 'Estado',
    accessorKey: 'status',
    width: 150,
    filter: {
      kind: 'select',
      options: (Object.keys(STATUS_LABELS) as Employee['status'][]).map((value) => ({
        value,
        label: STATUS_LABELS[value],
      })),
    },
    formatValue: (value) => STATUS_LABELS[value as Employee['status']] ?? String(value),
    renderCell: ({ value }) => {
      const status = value as Employee['status']
      const color = STATUS_COLORS[status]
      return (
        <span
          className={d.chip}
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
          }}
        >
          <i className={d.dot} />
          {STATUS_LABELS[status]}
        </span>
      )
    },
  },
  {
    id: 'salary',
    header: 'Salario',
    subHeader: 'Bruto anual',
    accessorKey: 'salary',
    width: 150,
    align: 'right',
    filter: { kind: 'number', defaultOperator: 'gte' },
    formatValue: (value) => money.format(Number(value)),
    renderCell: ({ value }) => <span className={d.money}>{money.format(Number(value))}</span>,
  },
  {
    id: 'performance',
    header: 'Rendimiento',
    subHeader: 'Últimos 12 meses',
    accessorKey: 'performance',
    width: 190,
    filter: { kind: 'number', defaultOperator: 'between', operators: ['between', 'gte', 'lte'] },
    formatValue: (value) => `${value}%`,
    renderCell: ({ value }) => {
      const n = Number(value)
      const color = n >= 70 ? '#16a34a' : n >= 40 ? '#d97706' : '#dc2626'
      return (
        <span className={d.meter}>
          <span className={d.track}>
            <span className={d.fill} style={{ width: `${n}%`, background: color }} />
          </span>
          <span className={d.value}>{n}%</span>
        </span>
      )
    },
  },
  {
    id: 'projects',
    header: 'Proyectos',
    accessorKey: 'projects',
    width: 120,
    align: 'center',
    filter: { kind: 'number', defaultOperator: 'gte' },
  },
  {
    id: 'startDate',
    header: 'Alta',
    subHeader: 'Fecha de inicio',
    accessorKey: 'startDate',
    width: 170,
    filter: { kind: 'date' },
    formatValue: (value) => (value ? dateFmt.format(new Date(String(value))) : ''),
  },
  {
    id: 'country',
    header: 'País',
    accessorKey: 'country',
    width: 140,
    filter: { kind: 'select' },
  },
  {
    id: 'remote',
    header: 'Remoto',
    accessorKey: 'remote',
    width: 110,
    align: 'center',
    filter: { kind: 'boolean' },
    formatValue: (value) => (value ? 'Sí' : 'No'),
    renderCell: ({ value }) => (value ? '🏠' : '🏢'),
  },
  {
    id: 'email',
    header: 'Correo',
    accessorKey: 'email',
    width: 230,
    hidden: true,
    filter: { kind: 'text' },
  },
]
