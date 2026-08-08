'use client'

import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import s from '../DataTable.module.css'
import { PortalContext } from '../portalContext'
import { cx } from '../utils'

const GAP = 6
const MARGIN = 8

interface Position {
  top: number
  left: number
  maxHeight: number
}

export interface PopoverProps {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  /** `end` alinea el borde derecho con el del ancla; `start`, el izquierdo. */
  align?: 'start' | 'end'
  minWidth?: number
  matchAnchorWidth?: boolean
  role?: string
  ariaMultiselectable?: boolean
  className?: string
  children: ReactNode
}

export function Popover({
  anchorRef,
  open,
  onClose,
  align = 'end',
  minWidth,
  matchAnchorWidth = false,
  role = 'menu',
  ariaMultiselectable,
  className,
  children,
}: PopoverProps): ReactNode {
  const host = useContext(PortalContext)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const rect = anchor.getBoundingClientRect()
    const width = Math.max(panel.offsetWidth, minWidth ?? 0, matchAnchorWidth ? rect.width : 0)
    const height = panel.offsetHeight

    let left = align === 'end' ? rect.right - width : rect.left
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, window.innerWidth - width - MARGIN))

    const spaceBelow = window.innerHeight - rect.bottom - MARGIN - GAP
    const spaceAbove = rect.top - MARGIN - GAP
    // Se abre hacia arriba solo si abajo no cabe y arriba hay más sitio.
    const openUp = height > spaceBelow && spaceAbove > spaceBelow

    const maxHeight = Math.max(120, openUp ? spaceAbove : spaceBelow)
    const top = openUp
      ? Math.max(MARGIN, rect.top - GAP - Math.min(height, maxHeight))
      : rect.bottom + GAP

    setPos((prev) =>
      prev && prev.top === top && prev.left === left && prev.maxHeight === maxHeight
        ? prev
        : { top, left, maxHeight },
    )
  }, [align, anchorRef, matchAnchorWidth, minWidth])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onScroll = () => place()
    window.addEventListener('resize', onScroll)
    // `capture` para enterarse también del scroll del contenedor de la tabla.
    document.addEventListener('scroll', onScroll, true)
    const observer = new ResizeObserver(onScroll)
    if (panelRef.current) observer.observe(panelRef.current)
    return () => {
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('scroll', onScroll, true)
      observer.disconnect()
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || !host) return null

  return createPortal(
    <div
      ref={panelRef}
      className={cx(s.popover, className)}
      role={role}
      aria-multiselectable={ariaMultiselectable}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        maxHeight: pos?.maxHeight,
        minWidth,
        // Primer frame: el panel se mide antes de poder colocarse.
        visibility: pos ? undefined : 'hidden',
      }}
    >
      {children}
    </div>,
    host,
  )
}
