export interface Employee {
  id: string
  name: string
  email: string
  department: string
  role: string
  status: 'active' | 'onboarding' | 'leave' | 'offboarded'
  salary: number
  performance: number
  startDate: string
  country: string
  projects: number
  remote: boolean
}

/* PRNG determinista: los mismos datos en cada recarga, sin depender de Math.random. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = [
  'Lucía', 'Mateo', 'Sofía', 'Diego', 'Valentina', 'Hugo', 'Martina', 'Bruno',
  'Emma', 'Nicolás', 'Julia', 'Álvaro', 'Carmen', 'Iván', 'Noa', 'Sergio',
  'Paula', 'Andrés', 'Elena', 'Tomás', 'Irene', 'Pablo', 'Nadia', 'Óscar',
]
const LAST = [
  'García', 'Fernández', 'Rodríguez', 'Moreno', 'Navarro', 'Iglesias', 'Ortega',
  'Ramírez', 'Delgado', 'Castillo', 'Vargas', 'Cabrera', 'Suárez', 'Pardo',
  'Mendoza', 'Herrera', 'Rojas', 'Peña', 'Salazar', 'Cortés',
]
const DEPARTMENTS = ['Ingeniería', 'Producto', 'Diseño', 'Ventas', 'Marketing', 'Soporte', 'Finanzas', 'RR. HH.']
const ROLES: Record<string, string[]> = {
  'Ingeniería': ['Backend', 'Frontend', 'SRE', 'Data', 'Mobile', 'QA'],
  'Producto': ['PM', 'PO', 'Analista'],
  'Diseño': ['UI', 'UX', 'Research', 'Motion'],
  'Ventas': ['AE', 'SDR', 'Account Manager'],
  'Marketing': ['Growth', 'Contenido', 'Brand'],
  'Soporte': ['L1', 'L2', 'Success'],
  'Finanzas': ['Controller', 'Contable', 'FP&A'],
  'RR. HH.': ['Recruiter', 'People Ops'],
}
const COUNTRIES = ['España', 'México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Portugal', 'Uruguay']
const STATUSES: Employee['status'][] = ['active', 'active', 'active', 'onboarding', 'leave', 'offboarded']

export function generateEmployees(count: number, seed = 20260807): Employee[] {
  const rand = mulberry32(seed)
  const pick = <V,>(list: V[]): V => list[Math.floor(rand() * list.length)]

  return Array.from({ length: count }, (_, i) => {
    const first = pick(FIRST)
    const last = pick(LAST)
    const department = pick(DEPARTMENTS)
    const year = 2015 + Math.floor(rand() * 11)
    const month = 1 + Math.floor(rand() * 12)
    const day = 1 + Math.floor(rand() * 28)

    return {
      id: `EMP-${String(i + 1).padStart(5, '0')}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${last
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')}${i}@acme.io`,
      department,
      role: pick(ROLES[department]),
      status: pick(STATUSES),
      salary: 24000 + Math.floor(rand() * 96000),
      performance: Math.floor(rand() * 101),
      startDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      country: pick(COUNTRIES),
      projects: Math.floor(rand() * 14),
      remote: rand() > 0.45,
    }
  })
}

export const STATUS_LABELS: Record<Employee['status'], string> = {
  active: 'Activo',
  onboarding: 'Onboarding',
  leave: 'Excedencia',
  offboarded: 'Baja',
}
