'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Navegación de teclado del cuerpo de la tabla (patrón ARIA grid, roving
 * tabindex). Todo por delegación y manipulación DOM directa: navegar con
 * flechas NO pasa por React — cero renders por pulsación.
 *
 *  - ← → ↑ ↓ mueven la celda activa (conscientes de `dir`)
 *  - Home/End: primera/última celda de la fila
 *  - Ctrl/⌘ + Home/End: primera/última celda del cuerpo
 *  - Enter o Espacio: activa el primer control interactivo de la celda
 */
export function useGridKeyboardNav(scrollerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const cells = (row: HTMLTableRowElement) =>
      [...row.cells].filter((c) => !c.hasAttribute('aria-hidden'))

    const dataRows = (): HTMLTableRowElement[] =>
      [...scroller.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row="1"]')]

    const setActive = (cell: HTMLTableCellElement | null, focus = true) => {
      if (!cell) return
      for (const prev of scroller.querySelectorAll<HTMLTableCellElement>(
        'tbody td[tabindex="0"]',
      )) {
        prev.tabIndex = -1
      }
      cell.tabIndex = 0
      if (focus) {
        cell.focus({ preventScroll: true })
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Solo cuando el foco está EN la celda (no en un input/botón interno).
      const cell = target.closest<HTMLTableCellElement>('tbody td')
      if (!cell || target !== cell) return
      const row = cell.parentElement as HTMLTableRowElement
      if (row.dataset.row !== '1') return

      const rtl = getComputedStyle(scroller).direction === 'rtl'
      const rowCells = cells(row)
      const colIndex = rowCells.indexOf(cell)
      const rows = dataRows()
      const rowIndex = rows.indexOf(row)

      let next: HTMLTableCellElement | null | undefined
      switch (e.key) {
        case 'ArrowRight':
          next = rowCells[colIndex + (rtl ? -1 : 1)]
          break
        case 'ArrowLeft':
          next = rowCells[colIndex + (rtl ? 1 : -1)]
          break
        case 'ArrowDown':
          next = rows[rowIndex + 1] && cells(rows[rowIndex + 1])[colIndex]
          break
        case 'ArrowUp':
          next = rows[rowIndex - 1] && cells(rows[rowIndex - 1])[colIndex]
          break
        case 'Home':
          next =
            e.ctrlKey || e.metaKey ? cells(rows[0])[0] : rowCells[0]
          break
        case 'End':
          next =
            e.ctrlKey || e.metaKey
              ? cells(rows[rows.length - 1]).at(-1)
              : rowCells.at(-1)
          break
        case 'Enter':
        case ' ': {
          const control = cell.querySelector<HTMLElement>(
            'input, button, a[href], [role="button"]',
          )
          if (control) {
            e.preventDefault()
            control.click()
          }
          return
        }
        default:
          return
      }
      if (!next) return
      e.preventDefault()
      setActive(next)
    }

    // Un clic también fija la celda activa (roving) sin robar el foco a
    // los controles internos.
    const onPointerDown = (e: PointerEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('tbody td')
      if (cell && (cell.parentElement as HTMLTableRowElement).dataset.row === '1') {
        setActive(cell, false)
      }
    }

    // Garantiza exactamente UN tabstop aunque la página de filas cambie.
    const ensureTabstop = () => {
      if (scroller.querySelector('tbody td[tabindex="0"]')) return
      const first = dataRows()[0]
      if (first) setActive(cells(first)[0] ?? null, false)
    }

    const observer = new MutationObserver(ensureTabstop)
    const tbody = scroller.querySelector('tbody')
    if (tbody) observer.observe(tbody, { childList: true, subtree: false })
    ensureTabstop()

    scroller.addEventListener('keydown', onKeyDown)
    scroller.addEventListener('pointerdown', onPointerDown)
    return () => {
      observer.disconnect()
      scroller.removeEventListener('keydown', onKeyDown)
      scroller.removeEventListener('pointerdown', onPointerDown)
    }
  }, [scrollerRef])
}
