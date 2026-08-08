'use client'

import { createContext } from 'react'
import type { Context } from 'react'

/**
 * Host de los popovers. Es un hijo del root de la tabla (hereda los tokens
 * `--dt-*`, incluidos los inline de `theme`) pero con `position: fixed`, así
 * que ni el `overflow` del scroller ni el stacking context de los `<th>`
 * sticky lo recortan.
 */
export const PortalContext: Context<HTMLElement | null> = createContext<HTMLElement | null>(null)
