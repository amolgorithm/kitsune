// src/renderer/lib/appearance.ts
// Core appearance engine. Applies AppearanceSettings to the DOM live.
import type { AppearanceSettings, ThemeBase } from '../../shared/types'

let canvasCleanup: (() => void) | null = null

// ─── Accent palette ───────────────────────────────────────────────
const ACCENT: Record<string, { base: string; light: string; dim: string; glow: string }> = {
  fox:     { base:'#ff6b35', light:'#ff9a6c', dim:'rgba(255,107,53,0.15)',  glow:'rgba(255,107,53,0.35)' },
  violet:  { base:'#8b5cf6', light:'#a78bfa', dim:'rgba(139,92,246,0.15)', glow:'rgba(139,92,246,0.35)' },
  cyan:    { base:'#06b6d4', light:'#22d3ee', dim:'rgba(6,182,212,0.15)',   glow:'rgba(6,182,212,0.35)'  },
  rose:    { base:'#f43f5e', light:'#fb7185', dim:'rgba(244,63,94,0.15)',   glow:'rgba(244,63,94,0.35)'  },
  emerald: { base:'#10b981', light:'#34d399', dim:'rgba(16,185,129,0.15)', glow:'rgba(16,185,129,0.35)' },
  amber:   { base:'#f59e0b', light:'#fbbf24', dim:'rgba(245,158,11,0.15)', glow:'rgba(245,158,11,0.35)' },
  indigo:  { base:'#6366f1', light:'#818cf8', dim:'rgba(99,102,241,0.15)', glow:'rgba(99,102,241,0.35)' },
  pink:    { base:'#ec4899', light:'#f472b6', dim:'rgba(236,72,153,0.15)', glow:'rgba(236,72,153,0.35)' },
}

// ─── Theme palette ────────────────────────────────────────────────
interface ThemePalette {
  bg: string; s1: string; s2: string; s3: string; s4: string
  border: string; b2: string; b3: string
  text: string; text2: string; text3: string; text4: string
  glass: string
}

const THEMES: Record<string, ThemePalette> = {
  dark: {
    bg:'#0d0f12', s1:'#13161c', s2:'#1a1e27', s3:'#222737', s4:'#2a3045',
    border:'rgba(255,255,255,0.06)', b2:'rgba(255,255,255,0.09)', b3:'rgba(255,255,255,0.14)',
    text:'#e8eaf0', text2:'#9ca3b0', text3:'#6b7280', text4:'#4b5563',
    glass:'rgba(255,255,255,0.04)',
  },
  midnight: {
    bg:'#0a0a14', s1:'#111126', s2:'#181833', s3:'#202044', s4:'#282855',
    border:'rgba(160,150,255,0.10)', b2:'rgba(160,150,255,0.16)', b3:'rgba(160,150,255,0.22)',
    text:'#eae8ff', text2:'#a8a0e0', text3:'#7870b8', text4:'#504890',
    glass:'rgba(160,150,255,0.06)',
  },
  forest: {
    bg:'#071009', s1:'#0e1c11', s2:'#16261a', s3:'#1e3223', s4:'#263e2c',
    border:'rgba(100,220,130,0.09)', b2:'rgba(100,220,130,0.15)', b3:'rgba(100,220,130,0.22)',
    text:'#e6f5ea', text2:'#9dc8a8', text3:'#6a9e78', text4:'#4a7258',
    glass:'rgba(100,220,130,0.05)',
  },
  volcano: {
    bg:'#100907', s1:'#1d1108', s2:'#26180c', s3:'#301f10', s4:'#3a2614',
    border:'rgba(255,120,60,0.10)', b2:'rgba(255,120,60,0.16)', b3:'rgba(255,120,60,0.22)',
    text:'#faf0ec', text2:'#d4a898', text3:'#a87060', text4:'#784848',
    glass:'rgba(255,120,60,0.06)',
  },
  ocean: {
    bg:'#060c15', s1:'#0b1525', s2:'#101e35', s3:'#182845', s4:'#203255',
    border:'rgba(40,180,220,0.10)', b2:'rgba(40,180,220,0.16)', b3:'rgba(40,180,220,0.22)',
    text:'#e8f4fc', text2:'#90c8e0', text3:'#5898b8', text4:'#386880',
    glass:'rgba(40,180,220,0.06)',
  },
  dusk: {
    bg:'#0f0c17', s1:'#171424', s2:'#201c31', s3:'#29243e', s4:'#322c4b',
    border:'rgba(180,140,255,0.10)', b2:'rgba(180,140,255,0.16)', b3:'rgba(180,140,255,0.22)',
    text:'#ede8ff', text2:'#b0a0d8', text3:'#7868a8', text4:'#504878',
    glass:'rgba(180,140,255,0.06)',
  },
  light: {
    bg:'#f5f5f7', s1:'#ffffff', s2:'#f0f0f3', s3:'#e5e5ea', s4:'#d8d8e0',
    border:'rgba(0,0,0,0.06)', b2:'rgba(0,0,0,0.10)', b3:'rgba(0,0,0,0.16)',
    text:'#1a1a1a', text2:'#4a4a5a', text3:'#6e6e7e', text4:'#9e9eae',
    glass:'rgba(0,0,0,0.03)',
  },
}

// ─── Main apply ───────────────────────────────────────────────────
export function applyAppearance(a: AppearanceSettings, _legacy?: ThemeBase): void {
  const root = document.documentElement
  const app  = document.querySelector('.app') as HTMLElement | null

  // 1. Resolve theme
  const themeKey = a.themeBase ?? _legacy ?? 'dark'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = themeKey !== 'light' && !(themeKey === 'system' && !prefersDark)
  const resolvedKey = themeKey === 'system' ? (prefersDark ? 'dark' : 'light') : themeKey

  root.classList.toggle('theme-dark',  isDark)
  root.classList.toggle('theme-light', !isDark)

  // 2. Apply full palette inline — overrides tokens.css completely
  const p = THEMES[resolvedKey] ?? THEMES.dark!
  root.style.setProperty('--k-bg',       p.bg)
  root.style.setProperty('--k-surface',  p.s1)
  root.style.setProperty('--k-surface-2',p.s2)
  root.style.setProperty('--k-surface-3',p.s3)
  root.style.setProperty('--k-surface-4',p.s4)
  root.style.setProperty('--k-border',   p.border)
  root.style.setProperty('--k-border-2', p.b2)
  root.style.setProperty('--k-border-3', p.b3)
  root.style.setProperty('--k-text',     p.text)
  root.style.setProperty('--k-text-2',   p.text2)
  root.style.setProperty('--k-text-3',   p.text3)
  root.style.setProperty('--k-text-4',   p.text4)
  root.style.setProperty('--k-glass',    p.glass)

  // 3. Accent color — always set inline properties directly
  const accent = a.accentPreset === 'custom'
    ? buildCustomAccent(a.accentCustom)
    : ACCENT[a.accentPreset] ?? ACCENT.fox!
  root.style.setProperty('--k-fox',      accent.base)
  root.style.setProperty('--k-fox-2',    accent.light)
  root.style.setProperty('--k-fox-dim',  accent.dim)
  root.style.setProperty('--k-fox-glow', accent.glow)

  // 4. Panel transparency — when animation active, chrome panels become semi-transparent
  //    so the canvas bleeds through. Opacity scales with animation intensity.
  root.setAttribute('data-animated', String(a.animationStyle !== 'none'))
  if (a.animationStyle !== 'none') {
    const opacity = Math.max(0.45, 0.88 - (a.animationIntensity / 100) * 0.43)
    const [rb, gb2, bb] = hexToRgb(p.bg)
    const [rs, gs, bs] = hexToRgb(p.s1)
    root.style.setProperty('--k-panel-bg',      `rgba(${rb},${gb2},${bb},${opacity})`)
    root.style.setProperty('--k-panel-surface',  `rgba(${rs},${gs},${bs},${opacity})`)
  } else {
    // Fully opaque — no animation, no transparency needed
    root.style.setProperty('--k-panel-bg',      p.bg)
    root.style.setProperty('--k-panel-surface',  p.s1)
  }

  // 5. Background on .app element
  if (app) applyBackground(app, a, p, accent.base)

  // 6. Grain texture
  root.setAttribute('data-texture', a.textureStyle)

  // 7. Border radius
  const RADII_MAP = {
    sharp:   { sm:'2px',  md:'4px',  base:'6px',  lg:'8px',   xl:'10px' },
    rounded: { sm:'6px',  md:'10px', base:'12px', lg:'16px',  xl:'20px' },
    pill:    { sm:'99px', md:'99px', base:'99px', lg:'99px',  xl:'99px' },
  }
  const radii = RADII_MAP[a.borderRadius] ?? RADII_MAP.rounded
  root.style.setProperty('--k-radius-sm', radii.sm)
  root.style.setProperty('--k-radius',    radii.base)
  root.style.setProperty('--k-radius-md', radii.md)
  root.style.setProperty('--k-radius-lg', radii.lg)
  root.style.setProperty('--k-radius-xl', radii.xl)

  // 8. Sidebar blur
  root.setAttribute('data-sidebar-blur', String(a.sidebarBlur))

  // 9. Sidebar style class for animation glow
  root.style.setProperty('--k-sidebar-blur-px', a.sidebarBlur ? '28px' : '0px')

  // 10. Font / layout
  root.style.setProperty('font-size',    `${a.fontScale * 13}px`)
  root.style.setProperty('--k-sidebar-w',`${a.sidebarWidth}px`)
  root.style.setProperty('--k-tab-h',    `${a.tabHeight}px`)

  // 11. Canvas animation — MUST be below all chrome
  if (canvasCleanup) { canvasCleanup(); canvasCleanup = null }
  if (a.animationStyle !== 'none' && app) {
    canvasCleanup = startCanvasAnimation(app, a.animationStyle, a.animationIntensity / 100, accent.base)
  }
}

// ─── Background ───────────────────────────────────────────────────
function applyBackground(
  app: HTMLElement, a: AppearanceSettings, p: ThemePalette, accentHex: string
): void {
  const from = a.backgroundGradientFrom || p.bg
  const to   = a.backgroundGradientTo   || p.s2

  // Ensure app creates stacking context so canvas stays below chrome
  app.style.position  = 'relative'
  app.style.isolation = 'isolate'

  switch (a.backgroundStyle) {
    case 'plain':
      app.style.background = p.bg; break
    case 'gradient-linear':
      app.style.background = `linear-gradient(135deg, ${from} 0%, ${to} 100%)`; break
    case 'gradient-mesh':
      app.style.background =
        `radial-gradient(ellipse 80% 60% at 15% 15%, ${from}cc 0%, transparent 55%),` +
        `radial-gradient(ellipse 60% 80% at 85% 85%, ${to}cc 0%, transparent 55%),` +
        `${p.bg}`; break
    case 'gradient-accent':
      app.style.background =
        `radial-gradient(ellipse 70% 50% at 20% 20%, ${accentHex}22 0%, transparent 60%),` +
        `radial-gradient(ellipse 50% 70% at 80% 80%, ${accentHex}14 0%, transparent 60%),` +
        `${p.bg}`; break
    case 'dots':
      app.style.background =
        `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px),${p.bg}`
      app.style.backgroundSize = '24px 24px'; break
    case 'grid':
      app.style.background = p.bg
      app.style.backgroundImage =
        `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),` +
        `linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`
      app.style.backgroundSize = '32px 32px'; break
    case 'noise':
      app.style.background = p.bg; break
    default:
      app.style.background = p.bg
  }
}

// ─── Canvas animation ─────────────────────────────────────────────
// Canvas is appended to .app with position:absolute z-index:0
// .app has isolation:isolate so the canvas stays BELOW sidebar (z-50), navbar (z-60) etc.
function startCanvasAnimation(
  app: HTMLElement, style: string, intensity: number, accentHex: string
): () => void {
  const canvas  = document.createElement('canvas')
  canvas.style.cssText = [
    'position:absolute', 'inset:0', 'z-index:0',
    'width:100%', 'height:100%', 'pointer-events:none',
  ].join(';')
  app.insertBefore(canvas, app.firstChild)   // insert before chrome, not after

  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  let raf  = 0
  let stopped = false
  const [r, g, b] = hexToRgb(accentHex)

  const W = () => window.innerWidth
  const H = () => window.innerHeight

  function resize() {
    canvas.width  = W() * dpr
    canvas.height = H() * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  // ── Sidebar glow pulse (drives --k-sidebar-glow on the sidebar element)
  const sidebar = document.querySelector('[class*="sidebar"]') as HTMLElement | null
  let sRaf = 0
  function pulseSidebar() {
    if (stopped) return
    const t = performance.now() / 1000
    const pulse = (Math.sin(t * 0.5) + 1) / 2
    const alpha = 0.03 + pulse * 0.06 * intensity
    app.style.setProperty('--k-sidebar-glow', `rgba(${r},${g},${b},${alpha})`)
    sRaf = requestAnimationFrame(pulseSidebar)
  }
  pulseSidebar()

  // ── Bubble ────────────────────────────────────────────────────────
  if (style === 'bubbles') {
    const N = Math.round(8 + intensity * 14)
    const bs = Array.from({ length: N }, () => ({
      x: Math.random() * W(),
      y: H() + Math.random() * H() * 0.5,
      r: 20 + Math.random() * 80,
      spd: 0.3 + Math.random() * 0.8 * intensity,
      wob: Math.random() * Math.PI * 2,
      ws:  0.01 + Math.random() * 0.02,
      a:   0.04 + Math.random() * 0.08 * intensity,
    }))
    ;(function draw() {
      if (stopped) return
      ctx.clearRect(0, 0, W(), H())
      for (const b2 of bs) {
        b2.y -= b2.spd; b2.wob += b2.ws; b2.x += Math.sin(b2.wob) * 0.6
        if (b2.y < -b2.r * 2) { b2.y = H() + b2.r; b2.x = Math.random() * W() }
        const g2 = ctx.createRadialGradient(b2.x-b2.r*.3, b2.y-b2.r*.3, b2.r*.1, b2.x, b2.y, b2.r)
        g2.addColorStop(0, `rgba(${r},${g},${b},${b2.a*1.6})`)
        g2.addColorStop(.5, `rgba(${r},${g},${b},${b2.a*.5})`)
        g2.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath(); ctx.arc(b2.x, b2.y, b2.r, 0, Math.PI*2)
        ctx.fillStyle = g2; ctx.fill()
        ctx.beginPath(); ctx.arc(b2.x, b2.y, b2.r, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${r},${g},${b},${b2.a*.35})`; ctx.lineWidth=1; ctx.stroke()
        ctx.beginPath(); ctx.arc(b2.x-b2.r*.35, b2.y-b2.r*.35, b2.r*.18, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,255,255,${b2.a*1.1})`; ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    })()
  }

  // ── Aurora ────────────────────────────────────────────────────────
  else if (style === 'aurora') {
    const layers = [
      { spd:0.00015, amp:0.35, phase:0,            ca:`rgba(${r},${g},${b},${0.15+intensity*.12})` },
      { spd:0.0002,  amp:0.25, phase:Math.PI*.6,   ca:`rgba(${Math.min(255,b+60)},${g},${r},${0.10+intensity*.09})` },
      { spd:0.00012, amp:0.20, phase:Math.PI*1.2,  ca:`rgba(${r},${Math.min(255,g+40)},${Math.min(255,b+80)},${0.08+intensity*.08})` },
    ]
    ;(function draw() {
      if (stopped) return
      ctx.clearRect(0, 0, W(), H())
      const t = performance.now()
      for (const lay of layers) {
        const w=W(), h=H()
        const cy = h*(0.3+Math.sin(t*lay.spd+lay.phase)*lay.amp)
        const bh = h*(0.22+0.18*intensity)
        const grd = ctx.createLinearGradient(0, cy-bh, 0, cy+bh)
        grd.addColorStop(0,'rgba(0,0,0,0)'); grd.addColorStop(.4,lay.ca)
        grd.addColorStop(.6,lay.ca); grd.addColorStop(1,'rgba(0,0,0,0)')
        ctx.beginPath(); ctx.moveTo(0, cy-bh)
        for (let x=0; x<=w; x+=w/10) ctx.lineTo(x, cy-bh+Math.sin(x/w*Math.PI*3+t*lay.spd*1000)*28*intensity)
        for (let x=w; x>=0; x-=w/10) ctx.lineTo(x, cy+bh+Math.sin(x/w*Math.PI*3+t*lay.spd*1000+1)*28*intensity)
        ctx.closePath(); ctx.fillStyle=grd; ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    })()
  }

  // ── Particles ─────────────────────────────────────────────────────
  else if (style === 'particles') {
    const N = Math.round(30 + intensity * 70)
    const pts = Array.from({length:N}, () => ({
      x:Math.random()*W(), y:Math.random()*H(),
      vx:(Math.random()-.5)*.4*intensity, vy:(Math.random()-.5)*.4*intensity,
      r:.8+Math.random()*2, a:.2+Math.random()*.6,
    }))
    const cd = 100 + intensity*60
    ;(function draw() {
      if (stopped) return
      ctx.clearRect(0, 0, W(), H())
      const w=W(), h=H()
      for (const p2 of pts) {
        p2.x+=p2.vx; p2.y+=p2.vy
        if(p2.x<0)p2.x=w; if(p2.x>w)p2.x=0; if(p2.y<0)p2.y=h; if(p2.y>h)p2.y=0
        const gd=ctx.createRadialGradient(p2.x,p2.y,0,p2.x,p2.y,p2.r*3)
        gd.addColorStop(0,`rgba(${r},${g},${b},${p2.a})`); gd.addColorStop(1,`rgba(${r},${g},${b},0)`)
        ctx.beginPath(); ctx.arc(p2.x,p2.y,p2.r*3,0,Math.PI*2); ctx.fillStyle=gd; ctx.fill()
      }
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
        const dx=pts[i]!.x-pts[j]!.x, dy=pts[i]!.y-pts[j]!.y, d=Math.sqrt(dx*dx+dy*dy)
        if(d<cd){ ctx.beginPath(); ctx.moveTo(pts[i]!.x,pts[i]!.y); ctx.lineTo(pts[j]!.x,pts[j]!.y)
          ctx.strokeStyle=`rgba(${r},${g},${b},${(1-d/cd)*.12*intensity})`; ctx.lineWidth=.5; ctx.stroke() }
      }
      raf = requestAnimationFrame(draw)
    })()
  }

  // ── Ripple ────────────────────────────────────────────────────────
  else if (style === 'ripple') {
    type Ring = {x:number;y:number;radius:number;maxR:number;opacity:number;spd:number}
    const rings: Ring[] = []
    const interval = Math.round(700-intensity*500)
    let last = 0
    const spawn = () => rings.push({x:W()*(0.2+Math.random()*.6),y:H()*(0.2+Math.random()*.6),radius:10,maxR:180+intensity*200,opacity:.3+intensity*.3,spd:1+intensity*2})
    spawn(); spawn()
    ;(function draw() {
      if (stopped) return
      ctx.clearRect(0, 0, W(), H())
      const now=performance.now()
      if(now-last>interval){spawn();last=now}
      for(let i=rings.length-1;i>=0;i--){
        const ring=rings[i]!; ring.radius+=ring.spd; ring.opacity*=.986
        if(ring.radius>ring.maxR||ring.opacity<.005){rings.splice(i,1);continue}
        const fade=1-ring.radius/ring.maxR
        ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.radius,0,Math.PI*2)
        ctx.strokeStyle=`rgba(${r},${g},${b},${ring.opacity*fade})`; ctx.lineWidth=1.5; ctx.stroke()
        const gd=ctx.createRadialGradient(ring.x,ring.y,0,ring.x,ring.y,ring.radius)
        gd.addColorStop(.7,`rgba(${r},${g},${b},0)`)
        gd.addColorStop(1,`rgba(${r},${g},${b},${fade*.05*intensity})`)
        ctx.fillStyle=gd; ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    })()
  }

  // ── Starfield / Warp ──────────────────────────────────────────────
  else if (style === 'starfield') {
    const N = Math.round(80 + intensity * 120)
    const stars = Array.from({length:N}, () => ({
      x:Math.random()*W(), y:Math.random()*H(), z:Math.random()*W(), pz:0 as number,
    }))
    ;(function draw() {
      if (stopped) return
      const w=W(), h=H()
      ctx.fillStyle=`rgba(0,0,0,${0.06+(1-intensity)*.12})`
      ctx.fillRect(0,0,w,h)
      const spd=1+intensity*5
      for(const s of stars){
        s.pz=s.z; s.z-=spd
        if(s.z<=0){s.x=Math.random()*w;s.y=Math.random()*h;s.z=w;s.pz=s.z}
        const sx=(s.x-w/2)*(w/s.z)+w/2, sy=(s.y-h/2)*(w/s.z)+h/2
        const px=(s.x-w/2)*(w/s.pz)+w/2, py=(s.y-h/2)*(w/s.pz)+h/2
        const sz=Math.max(.5,(1-s.z/w)*3), alpha=(1-s.z/w)*.85
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(sx,sy)
        ctx.strokeStyle=`rgba(${r},${g},${b},${alpha})`; ctx.lineWidth=sz; ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    })()
  }

  // ── Lava lamp ─────────────────────────────────────────────────────
  else if (style === 'lava') {
    const blobs = Array.from({length:5+Math.round(intensity*3)}, (_, i) => ({
      x:W()*(0.1+Math.random()*.8), y:H()*(0.1+Math.random()*.8),
      vx:(Math.random()-.5)*.8*intensity, vy:(Math.random()-.5)*.8*intensity,
      radius:80+Math.random()*120, phase:Math.random()*Math.PI*2,
      ps:0.005+Math.random()*.01, hue:i/5,
    }))
    ;(function draw() {
      if (stopped) return
      ctx.clearRect(0, 0, W(), H())
      const w=W(), h=H()
      for(const bl of blobs){
        bl.phase+=bl.ps; bl.x+=bl.vx+Math.sin(bl.phase)*.5; bl.y+=bl.vy+Math.cos(bl.phase*1.3)*.5
        if(bl.x<-bl.radius)bl.x=w+bl.radius; if(bl.x>w+bl.radius)bl.x=-bl.radius
        if(bl.y<-bl.radius)bl.y=h+bl.radius; if(bl.y>h+bl.radius)bl.y=-bl.radius
        const br=bl.radius*(0.9+Math.sin(bl.phase*2)*.15)
        const bv=bl.hue>.5?Math.min(255,b+60):b
        const gd=ctx.createRadialGradient(bl.x,bl.y,0,bl.x,bl.y,br)
        const alpha=0.07+intensity*.11
        gd.addColorStop(0,`rgba(${r},${g},${bv},${alpha})`)
        gd.addColorStop(.6,`rgba(${r},${g},${bv},${alpha*.5})`)
        gd.addColorStop(1,`rgba(${r},${g},${bv},0)`)
        ctx.beginPath(); ctx.arc(bl.x,bl.y,br,0,Math.PI*2); ctx.fillStyle=gd; ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    })()
  }

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    cancelAnimationFrame(sRaf)
    window.removeEventListener('resize', resize)
    canvas.remove()
    app.style.removeProperty('--k-sidebar-glow')
  }
}

// ─── Helpers ──────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function buildCustomAccent(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  const l = (v: number) => Math.min(255, v + 50)
  return {
    base:  hex,
    light: `#${l(r).toString(16).padStart(2,'0')}${l(g).toString(16).padStart(2,'0')}${l(b).toString(16).padStart(2,'0')}`,
    dim:   `rgba(${r},${g},${b},0.15)`,
    glow:  `rgba(${r},${g},${b},0.35)`,
  }
}
