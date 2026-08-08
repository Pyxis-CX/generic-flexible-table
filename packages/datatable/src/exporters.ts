import type { ColumnDef } from './types'
import { getCellValue, toPlainText } from './utils'

export interface ExportPayload<T> {
  rows: T[]
  columns: ColumnDef<T>[]
  fileName: string
}

/** Cabecera en texto plano. `exportHeader` gana; si `header` no es string, cae al id. */
function headerText<T>(column: ColumnDef<T>): string {
  if (column.exportHeader) return column.exportHeader
  if (typeof column.header === 'string') return column.header
  return column.id
}

export function buildMatrix<T>(
  rows: T[],
  columns: ColumnDef<T>[],
): { head: string[]; body: string[][] } {
  const cols = columns.filter((c) => c.exportable !== false)
  return {
    head: cols.map(headerText),
    body: rows.map((row) => cols.map((c) => toPlainText(getCellValue(row, c), row, c))),
  }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revocar en el siguiente tick: Safari necesita que la URL siga viva durante el click.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export interface CsvOptions {
  delimiter?: string
  /** BOM UTF-8 para que Excel abra los acentos correctamente. */
  bom?: boolean
}

export function exportToCsv<T>(payload: ExportPayload<T>, options: CsvOptions = {}): void {
  const { delimiter = ',', bom = true } = options
  const { head, body } = buildMatrix(payload.rows, payload.columns)

  const escape = (value: string): string => {
    // Prefijo anti CSV-injection en celdas que empiezan por =, +, -, @
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /["\n\r]|[,;\t]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }

  const csv = [head, ...body].map((line) => line.map(escape).join(delimiter)).join('\r\n')
  const content = (bom ? '\uFEFF' : '') + csv
  download(new Blob([content], { type: 'text/csv;charset=utf-8;' }), `${payload.fileName}.csv`)
}

export interface PdfOptions {
  title?: string
  subtitle?: string
  orientation?: 'portrait' | 'landscape'
  /** Color de la cabecera en RGB 0-255. */
  headColor?: [number, number, number]
}

export async function exportToPdf<T>(
  payload: ExportPayload<T>,
  options: PdfOptions = {},
): Promise<void> {
  // Carga diferida: jspdf pesa ~350kb y solo hace falta al exportar.
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default

  const { orientation = 'landscape', headColor = [79, 70, 229] } = options
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  const { head, body } = buildMatrix(payload.rows, payload.columns)

  const marginTop = options.title ? 74 : 40

  if (options.title) {
    doc.setFontSize(15)
    doc.setTextColor(20, 22, 26)
    doc.text(options.title, 40, 44)
  }
  if (options.subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(120, 126, 138)
    doc.text(options.subtitle, 40, 58)
  }

  autoTable(doc, {
    head: [head],
    body,
    startY: marginTop,
    margin: { top: marginTop, left: 40, right: 40, bottom: 36 },
    styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak', lineColor: [230, 232, 236] },
    headStyles: { fillColor: headColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    theme: 'grid',
    didDrawPage: (data) => {
      const page = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(150, 155, 165)
      doc.text(
        `${page}`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 18,
      )
    },
  })

  doc.save(`${payload.fileName}.pdf`)
}
