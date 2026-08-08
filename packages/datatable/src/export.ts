// Entry de exportación: CSV siempre disponible; PDF carga jspdf con
// import() dinámico, así que jspdf/jspdf-autotable son peers OPCIONALES —
// si nunca exportas PDF, no los instales.

export { buildMatrix, exportToCsv, exportToPdf } from './exporters'
export type { CsvOptions, ExportPayload, PdfOptions } from './exporters'
