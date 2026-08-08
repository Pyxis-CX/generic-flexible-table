import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
  ...props,
})

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const IconArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)

export const IconArrowDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
)

export const IconSortNeutral = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ opacity: 0.55, ...p })}>
    <path d="M8 9 12 5l4 4M16 15l-4 4-4-4" />
  </svg>
)

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)

export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export const IconChevronsLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
  </svg>
)

export const IconChevronsRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
  </svg>
)

export const IconColumns = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </svg>
)

export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
  </svg>
)

export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
  </svg>
)

export const IconEye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const IconGrip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="9" cy="6" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="18" r="1" fill="currentColor" />
    <circle cx="15" cy="6" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="18" r="1" fill="currentColor" />
  </svg>
)

export const IconMore = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="19" r="1.4" fill="currentColor" />
  </svg>
)

export const IconDensity = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

export const IconRotate = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 22, height: 22, ...p })}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
)

export const IconInbox = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 26, height: 26, ...p })}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1Z" />
  </svg>
)
