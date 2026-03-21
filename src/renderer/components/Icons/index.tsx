// src/renderer/components/Icons/index.tsx
// Single source for all SVG icons. No emojis, no external deps.
// All icons are 1:1 sized — pass width/height/className as needed.

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const icon = (path: React.ReactNode, viewBox = '0 0 16 16') =>
  ({ size = 16, ...props }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {path}
    </svg>
  )

// Navigation
export const IconBack       = icon(<polyline points="10,4 6,8 10,12" />)
export const IconForward    = icon(<polyline points="6,4 10,8 6,12" />)
export const IconReload     = icon(<><path d="M13 3c-1.5-1.5-3.5-2-5.5-2C3.9 1 1 3.9 1 7.5S3.9 14 7.5 14c2 0 3.8-.9 5-2.3" /><polyline points="13,1 13,5 9,5" /></>)
export const IconStop       = icon(<rect x="4" y="4" width="8" height="8" rx="1" />)
export const IconSearch     = icon(<><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" /></>)
export const IconClose      = icon(<><line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" /></>)
export const IconChevronDown = icon(<polyline points="3,5 8,10 13,5" />)
export const IconChevronRight = icon(<polyline points="5,3 10,8 5,13" />)
export const IconArrowRight = icon(<><line x1="2" y1="8" x2="14" y2="8" /><polyline points="9,3 14,8 9,13" /></>)

// UI Elements
export const IconPlus       = icon(<><line x1="8" y1="2" x2="8" y2="14" /><line x1="2" y1="8" x2="14" y2="8" /></>)
export const IconMinus      = icon(<line x1="3" y1="8" x2="13" y2="8" />)
export const IconDots       = icon(<><circle cx="8" cy="4" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" /></>)
export const IconGrid       = icon(<><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></>)
export const IconList       = icon(<><line x1="3" y1="4" x2="13" y2="4" /><line x1="3" y1="8" x2="13" y2="8" /><line x1="3" y1="12" x2="10" y2="12" /></>)
export const IconCheck      = icon(<polyline points="2,8 6,12 14,4" />)
export const IconExternal   = icon(<><path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" /><polyline points="10,1 15,1 15,6" /><line x1="8" y1="8" x2="15" y2="1" /></>)

// Browser chrome
export const IconLock       = icon(<><rect x="3" y="7" width="10" height="8" rx="1" /><path d="M6 7V5a2 2 0 014 0v2" /><circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" /></>)
export const IconLockOpen   = icon(<><rect x="3" y="7" width="10" height="8" rx="1" /><path d="M6 7V5a2 2 0 014 0v2" strokeDasharray="3 2" /></>)
export const IconBookmark   = icon(<path d="M3 2h10v13l-5-3-5 3V2z" />)
export const IconShare      = icon(<><circle cx="12" cy="3" r="1.5" /><circle cx="12" cy="13" r="1.5" /><circle cx="4" cy="8" r="1.5" /><line x1="10.5" y1="3.9" x2="5.5" y2="7.1" /><line x1="10.5" y1="12.1" x2="5.5" y2="8.9" /></>)
export const IconTab        = icon(<><rect x="1" y="4" width="14" height="10" rx="1" /><path d="M1 7h5V4" /></>)
export const IconNewTab     = icon(<><rect x="1" y="4" width="14" height="10" rx="1" /><path d="M1 7h5V4" /><line x1="8" y1="9" x2="12" y2="9" /><line x1="10" y1="7" x2="10" y2="11" /></>)

// Security / Privacy
export const IconShield     = icon(<><path d="M8 1L2 4v5c0 3.3 2.7 6 6 6s6-2.7 6-6V4L8 1z" /><polyline points="5,8 7,10 11,6" strokeWidth={1.8} /></>)
export const IconShieldOff  = icon(<><path d="M8 1L2 4v5c0 3.3 2.7 6 6 6s6-2.7 6-6V4L8 1z" strokeDasharray="4 2" /><line x1="5" y1="5" x2="11" y2="11" /></>)
export const IconEye        = icon(<><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" /><circle cx="8" cy="8" r="2" /></>)
export const IconEyeOff     = icon(<><path d="M2 2l12 12M6.7 6.7A3 3 0 0011 10.3" /><path d="M9.9 3.1C9.3 3 8.7 3 8 3 4 3 1 8 1 8s.7 1.2 2 2.4" /><path d="M15 8s-.7-1.2-2-2.4" /></>)

// AI / Intelligence
export const IconSparkle    = icon(<><path d="M8 1v14M1 8h14M3.5 3.5l9 9M12.5 3.5l-9 9" strokeWidth={1} /><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" /></>)
export const IconBrain      = icon(<><path d="M8 3a3 3 0 00-3 3v1H4a2 2 0 000 4h1v1a3 3 0 006 0v-1h1a2 2 0 000-4h-1V6a3 3 0 00-3-3z" /><line x1="8" y1="9" x2="8" y2="11" /></>)
export const IconWand       = icon(<><line x1="3" y1="13" x2="10" y2="6" strokeWidth={2} /><path d="M11 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="currentColor" stroke="none" /></>)
export const IconChatBubble = icon(<><path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z" /></>)
export const IconNote       = icon(<><path d="M3 2h10a1 1 0 011 1v10l-3 3H3a1 1 0 01-1-1V3a1 1 0 011-1z" /><line x1="5" y1="6" x2="11" y2="6" /><line x1="5" y1="9" x2="9" y2="9" /></>)
export const IconSummary    = icon(<><rect x="2" y="2" width="12" height="12" rx="1" /><line x1="5" y1="5" x2="11" y2="5" /><line x1="5" y1="8" x2="11" y2="8" /><line x1="5" y1="11" x2="8" y2="11" /></>)
export const IconResearch   = icon(<><circle cx="8" cy="7" r="4" /><path d="M8 3v4l2 2" /><line x1="3" y1="13" x2="13" y2="13" /></>)
export const IconTask       = icon(<><polyline points="4,4 4,14 12,14" /><polyline points="4,7 8,11 14,5" /></>)

// Layout / Cleave
export const IconSplitH     = icon(<><rect x="1" y="1" width="6" height="14" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></>)
export const IconSplitV     = icon(<><rect x="1" y="1" width="14" height="6" rx="1" /><rect x="1" y="9" width="14" height="6" rx="1" /></>)
export const IconColumns    = icon(<><rect x="1" y="1" width="6" height="14" rx="1" /><rect x="9" y="1" width="6" height="14" rx="1" /></>)
export const IconLayout     = icon(<><rect x="1" y="1" width="14" height="14" rx="1" /><line x1="1" y1="5" x2="15" y2="5" /><line x1="8" y1="5" x2="8" y2="15" /></>)

// Workspace / Files
export const IconFolder     = icon(<><path d="M1 4h5l2 2h7a1 1 0 011 1v7a1 1 0 01-1 1H1a1 1 0 01-1-1V5a1 1 0 011-1z" /></>)
export const IconFile       = icon(<><path d="M3 2h7l4 4v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" /><polyline points="10,2 10,6 14,6" /></>)
export const IconFilePDF    = icon(<><path d="M3 2h7l4 4v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" /><text x="4" y="12" fontSize="5" fill="currentColor" stroke="none" fontWeight="bold">PDF</text></>, '0 0 16 16')
export const IconWorkspace  = icon(<><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></>)

// Status / Indicators
export const IconCircleFill = icon(<circle cx="8" cy="8" r="5" fill="currentColor" stroke="none" />)
export const IconSleep      = icon(<><path d="M4 6h8L6 10h8" /><path d="M7 3h5L8 7h5" strokeWidth={1} opacity={0.5} /></>)
export const IconWarning    = icon(<><path d="M8 2L1 14h14L8 2z" /><line x1="8" y1="7" x2="8" y2="10" /><circle cx="8" cy="12.5" r="0.5" fill="currentColor" stroke="none" /></>)
export const IconInfo       = icon(<><circle cx="8" cy="8" r="7" /><line x1="8" y1="7" x2="8" y2="11" /><circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" /></>)
export const IconLoading    = icon(<><circle cx="8" cy="8" r="6" strokeDasharray="10 28" /></>, '0 0 16 16')

// Settings / Controls
export const IconSettings   = icon(<><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" /></>)
export const IconHotkey     = icon(<><rect x="2" y="4" width="5" height="4" rx="1" /><rect x="9" y="4" width="5" height="4" rx="1" /><rect x="2" y="10" width="12" height="4" rx="1" /></>)
export const IconToggleOn   = icon(<><rect x="1" y="5" width="14" height="6" rx="3" fill="currentColor" stroke="none" /><circle cx="11" cy="8" r="2" fill="white" stroke="none" /></>)
export const IconToggleOff  = icon(<><rect x="1" y="5" width="14" height="6" rx="3" /><circle cx="5" cy="8" r="2" fill="currentColor" stroke="none" /></>)

// Lens / View modes
export const IconGlobe      = icon(<><circle cx="8" cy="8" r="7" /><path d="M8 1c-2 3-2 10 0 14M8 1c2 3 2 10 0 14M1 8h14" /></>)
export const IconCode       = icon(<><polyline points="4,5 1,8 4,11" /><polyline points="12,5 15,8 12,11" /><line x1="9" y1="3" x2="7" y2="13" /></>)
export const IconBook       = icon(<><path d="M2 3h6a1 1 0 011 1v11a1 1 0 01-1-1H2V3z" /><path d="M14 3H8a1 1 0 00-1 1v11c0-.6.4-1 1-1h6V3z" /></>)
export const IconPalette    = icon(<><circle cx="8" cy="8" r="6" /><circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="11" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="11" cy="10" r="1" fill="currentColor" stroke="none" /></>)

// User
export const IconUser       = icon(<><circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" /></>)
export const IconDot        = icon(<circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />)

// Favicon fallback shapes
export const IconPageDefault = icon(<><rect x="2" y="1" width="12" height="14" rx="1" /><line x1="5" y1="5" x2="11" y2="5" /><line x1="5" y1="8" x2="11" y2="8" /><line x1="5" y1="11" x2="8" y2="11" /></>)
export const IconGitHub     = icon(<path d="M8 1a7 7 0 00-2.2 13.6c.3.1.4-.1.4-.3V13c-1.8.4-2.2-.8-2.2-.8-.3-.7-.7-.9-.7-.9-.6-.4 0-.4 0-.4.6 0 1 .6 1 .6.6 1 1.5.7 1.9.5.1-.4.2-.7.4-.8-1.5-.2-3-1-3-3.3 0-.7.3-1.3.6-1.8 0-.2-.3-1 .1-2 0 0 .5-.2 1.8.7a6 6 0 013.2 0c1.2-.9 1.8-.7 1.8-.7.4 1 .1 1.8.1 2 .4.5.6 1.1.6 1.8 0 2.4-1.5 2.9-2.9 3.1.2.2.4.6.4 1.2v1.8c0 .2.1.4.4.3A7 7 0 008 1z" fill="currentColor" stroke="none" />)

// ── Appearance icons ──────────────────────────────────────────────
export const IconMoon       = icon(<><path d="M13 9A6 6 0 016 2a7 7 0 100 12 6 6 0 007-5z" fill="currentColor" stroke="none" opacity=".9" /></>)
export const IconSun        = icon(<><circle cx="8" cy="8" r="3" /><line x1="8" y1="1" x2="8" y2="3" /><line x1="8" y1="13" x2="8" y2="15" /><line x1="1" y1="8" x2="3" y2="8" /><line x1="13" y1="8" x2="15" y2="8" /><line x1="3" y1="3" x2="4.5" y2="4.5" /><line x1="11.5" y1="11.5" x2="13" y2="13" /><line x1="13" y1="3" x2="11.5" y2="4.5" /><line x1="4.5" y1="11.5" x2="3" y2="13" /></>)
export const IconMonitor    = icon(<><rect x="1" y="2" width="14" height="10" rx="1" /><line x1="5" y1="15" x2="11" y2="15" /><line x1="8" y1="12" x2="8" y2="15" /></>)
export const IconSidebarLeft  = icon(<><rect x="1" y="1" width="14" height="14" rx="1" /><line x1="5" y1="1" x2="5" y2="15" /></>)
export const IconSidebarRight = icon(<><rect x="1" y="1" width="14" height="14" rx="1" /><line x1="11" y1="1" x2="11" y2="15" /></>)
export const IconAnimNone   = icon(<><line x1="3" y1="8" x2="13" y2="8" strokeDasharray="2 2" /></>)
export const IconBubble     = icon(<><circle cx="5" cy="10" r="3" opacity=".5" /><circle cx="10" cy="6" r="4" opacity=".7" /><circle cx="7" cy="13" r="2" opacity=".4" /></>)
export const IconAurora     = icon(<><path d="M1 8c2-4 4-6 7-6s5 2 7 6" opacity=".3" /><path d="M1 8c2 2 5 5 7 5s5-3 7-5" opacity=".6" /><path d="M3 8c1-2 3-3 5-3s4 1 5 3" opacity=".9" /></>)
export const IconParticle   = icon(<><circle cx="3" cy="13" r="1" fill="currentColor" stroke="none" /><circle cx="7" cy="9" r="1.2" fill="currentColor" stroke="none" opacity=".7" /><circle cx="11" cy="5" r="1" fill="currentColor" stroke="none" opacity=".5" /><circle cx="5" cy="5" r=".8" fill="currentColor" stroke="none" opacity=".4" /><circle cx="13" cy="10" r="1.3" fill="currentColor" stroke="none" opacity=".8" /></>)
export const IconRipple     = icon(<><circle cx="8" cy="8" r="2" /><circle cx="8" cy="8" r="5" opacity=".5" /><circle cx="8" cy="8" r="7" opacity=".2" /></>)
export const IconGrain      = icon(<><path d="M2 4h1M5 2h1M9 3h1M13 5h1M3 7h1M7 6h1M11 8h1M1 10h1M5 11h1M9 9h1M13 12h1M3 13h1M7 14h1M11 11h1" strokeWidth="1.5" strokeLinecap="round" /></>)
export const IconMesh       = icon(<><circle cx="4" cy="4" r="3" opacity=".4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="3" opacity=".4" fill="currentColor" stroke="none" /><circle cx="12" cy="4" r="2" opacity=".25" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="2" opacity=".25" fill="currentColor" stroke="none" /></>)
export const IconGradientLinear = icon(<><defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="1"/><stop offset="100%" stopColor="currentColor" stopOpacity="0.1"/></linearGradient></defs><rect x="1" y="1" width="14" height="14" rx="2" fill="url(#gl)" stroke="none" /></>)
export const IconDotGrid    = icon(<><circle cx="4" cy="4" r=".8" fill="currentColor" stroke="none" /><circle cx="8" cy="4" r=".8" fill="currentColor" stroke="none" /><circle cx="12" cy="4" r=".8" fill="currentColor" stroke="none" /><circle cx="4" cy="8" r=".8" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".8" fill="currentColor" stroke="none" /><circle cx="12" cy="8" r=".8" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="8" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none" /></>)
export const IconLineGrid   = icon(<><line x1="1" y1="5" x2="15" y2="5" opacity=".4" /><line x1="1" y1="9" x2="15" y2="9" opacity=".4" /><line x1="1" y1="13" x2="15" y2="13" opacity=".4" /><line x1="5" y1="1" x2="5" y2="15" opacity=".4" /><line x1="9" y1="1" x2="9" y2="15" opacity=".4" /><line x1="13" y1="1" x2="13" y2="15" opacity=".4" /></>)
export const IconNoise      = icon(<><rect x="1" y="1" width="14" height="14" rx="2" opacity=".3" fill="currentColor" stroke="none" /><path d="M4 4h1v1H4zM8 3h1v2H8zM12 5h1v1H12zM3 8h2v1H3zM7 7h1v2H7zM11 6h2v2H11zM5 11h1v1H5zM9 10h1v2H9zM13 9h1v2H13z" fill="currentColor" stroke="none" opacity=".7" /></>)
