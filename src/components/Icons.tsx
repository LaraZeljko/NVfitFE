import type { ReactNode, SVGProps } from 'react'

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const ChevronLeft = () => (
  <Icon>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)

export const ChevronRight = () => (
  <Icon className="chevron">
    <path d="m9 18 6-6-6-6" />
  </Icon>
)

export const Plus = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const Close = () => (
  <Icon width={18} height={18}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)

export const More = () => (
  <Icon>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </Icon>
)

export const Calendar = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
)

export const Chart = () => (
  <Icon>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 5-6" />
  </Icon>
)

export const ArrowUp = () => (
  <Icon width={14} height={14} strokeWidth={2.5}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
)

export const ArrowDown = () => (
  <Icon width={14} height={14} strokeWidth={2.5}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </Icon>
)

export const Check = () => (
  <Icon width={14} height={14} strokeWidth={3}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)

export const Copy = () => (
  <Icon width={18} height={18}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
)

export const LogOut = () => (
  <Icon>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Icon>
)

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="112" fill="var(--surface-2)" />
      <g fill="var(--accent)" transform="rotate(-35 256 256)">
        <rect x="156" y="240" width="200" height="32" rx="10" />
        <rect x="124" y="176" width="44" height="160" rx="14" />
        <rect x="344" y="176" width="44" height="160" rx="14" />
        <rect x="84" y="204" width="36" height="104" rx="12" />
        <rect x="392" y="204" width="36" height="104" rx="12" />
      </g>
    </svg>
  )
}
