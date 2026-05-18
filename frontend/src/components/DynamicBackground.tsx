import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'

const ORB_STYLE: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(120px)',
  pointerEvents: 'none',
  willChange: 'transform, opacity',
}

export default function DynamicBackground() {
  const theme = useStore((state) => state.theme)
  const orb1 = useRef<HTMLDivElement>(null)
  const orb2 = useRef<HTMLDivElement>(null)
  const orb3 = useRef<HTMLDivElement>(null)
  const grainRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  useEffect(() => {
    let grainFrame = 0
    let grainRaf = 0

    // ── Animated grain ──────────────────────────────────────────────────────────
    const canvas = grainRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      const resize = () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
      resize()
      window.addEventListener('resize', resize)

      const drawGrain = () => {
        if (!ctx) return
        const w = canvas.width
        const h = canvas.height
        const imageData = ctx.createImageData(w, h)
        const data = imageData.data
        // shift seed every frame for animated shimmer
        const seed = grainFrame * 127
        for (let i = 0; i < data.length; i += 4) {
          const n = Math.sin(i + seed) * 43758.5453
          const noise = ((n - Math.floor(n)) * 255) | 0
          // accent-tinted noise
          data[i] = noise
          data[i + 1] = (noise * 0.55) | 0
          data[i + 2] = (noise * 0.82) | 0
          data[i + 3] = 16
        }
        ctx.putImageData(imageData, 0, 0)
        grainFrame++
        grainRaf = requestAnimationFrame(drawGrain)
      }
      drawGrain()

      return () => {
        window.removeEventListener('resize', resize)
        cancelAnimationFrame(grainRaf)
      }
    }
  }, [])

  useEffect(() => {
    // ── Orb drift animation ──────────────────────────────────────────────────────
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const t = (ts - startRef.current) / 1000

      if (orb1.current) {
        const x = Math.sin(t * 0.11) * 8 + Math.sin(t * 0.07) * 5
        const y = Math.cos(t * 0.09) * 10 + Math.cos(t * 0.13) * 4
        const scale = 1 + Math.sin(t * 0.15) * 0.06
        orb1.current.style.transform = `translate(${x}%, ${y}%) scale(${scale})`
        orb1.current.style.opacity = String(0.32 + Math.sin(t * 0.17) * 0.06)
      }
      if (orb2.current) {
        const x = Math.cos(t * 0.08) * 12 + Math.sin(t * 0.11) * 6
        const y = Math.sin(t * 0.1) * 8 + Math.cos(t * 0.06) * 5
        const scale = 1 + Math.cos(t * 0.12) * 0.08
        orb2.current.style.transform = `translate(${x}%, ${y}%) scale(${scale})`
        orb2.current.style.opacity = String(0.22 + Math.cos(t * 0.14) * 0.05)
      }
      if (orb3.current) {
        const x = Math.sin(t * 0.07 + 1) * 10 + Math.cos(t * 0.09) * 4
        const y = Math.cos(t * 0.12 + 2) * 7 + Math.sin(t * 0.08) * 6
        const scale = 1 + Math.sin(t * 0.1 + 0.5) * 0.07
        orb3.current.style.transform = `translate(${x}%, ${y}%) scale(${scale})`
        orb3.current.style.opacity = String(0.18 + Math.sin(t * 0.19) * 0.04)
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Orb 1 — accent bloom, top-left */}
      <div
        ref={orb1}
        style={{
          ...ORB_STYLE,
          width: '55vw',
          height: '55vw',
          top: '-15%',
          left: '-10%',
          background: theme === 'light'
            ? 'radial-gradient(circle, rgba(255,170,121,0.30) 0%, rgba(255,205,171,0.20) 34%, rgba(255,232,214,0.12) 54%, transparent 78%)'
            : 'radial-gradient(circle, rgba(255,112,92,0.42) 0%, rgba(255,112,92,0.18) 34%, rgba(255,87,183,0.06) 58%, transparent 78%)',
          opacity: theme === 'light' ? 0.5 : 0.36,
        }}
      />
      {/* Orb 2 — accent shadow, bottom-right */}
      <div
        ref={orb2}
        style={{
          ...ORB_STYLE,
          width: '50vw',
          height: '50vw',
          bottom: '-10%',
          right: '-8%',
          background: theme === 'light'
            ? 'radial-gradient(circle, rgba(179,150,255,0.28) 0%, rgba(211,188,255,0.18) 34%, rgba(236,226,255,0.11) 52%, transparent 76%)'
            : 'radial-gradient(circle, rgba(130,64,255,0.46) 0%, rgba(255,87,183,0.18) 38%, rgba(63,26,150,0.12) 58%, transparent 74%)',
          opacity: theme === 'light' ? 0.34 : 0.3,
        }}
      />
      {/* Orb 3 — soft accent haze, center-left mid */}
      <div
        ref={orb3}
        style={{
          ...ORB_STYLE,
          width: '35vw',
          height: '35vw',
          top: '40%',
          left: '20%',
          background: theme === 'light'
            ? 'radial-gradient(circle, rgba(255,168,224,0.18) 0%, rgba(254,119,201,0.1) 36%, rgba(255,214,239,0.07) 54%, rgba(184,79,144,0.035) 64%, transparent 76%)'
            : 'radial-gradient(circle, rgba(255,87,183,0.18) 0%, rgba(129,75,255,0.12) 42%, rgba(20,18,70,0.09) 58%, transparent 74%)',
          opacity: theme === 'light' ? 0.28 : 0.2,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: theme === 'light'
            ? 'radial-gradient(ellipse at 14% 18%, rgba(255,184,128,0.16) 0%, transparent 34%), radial-gradient(ellipse at 82% 24%, rgba(190,157,255,0.17) 0%, transparent 36%), radial-gradient(ellipse at 74% 76%, rgba(217,185,255,0.10) 0%, transparent 40%), linear-gradient(180deg, rgba(255,255,255,0.82), rgba(250,248,245,0.76))'
            : 'transparent',
          opacity: theme === 'light' ? 1 : 0,
        }}
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: theme === 'light' ? 0.32 : 0.46 }}
      >
        <defs>
          <linearGradient id="cult-scene-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={theme === 'light' ? '#f0b98f' : '#ff765f'} stopOpacity={theme === 'light' ? '0.38' : '0.34'} />
            <stop offset="48%" stopColor={theme === 'light' ? '#ffffff' : '#ff57b7'} stopOpacity={theme === 'light' ? '0.16' : '0.2'} />
            <stop offset="100%" stopColor={theme === 'light' ? '#b99cff' : '#8f56ff'} stopOpacity={theme === 'light' ? '0.42' : '0.44'} />
          </linearGradient>
          <radialGradient id="cult-dark-planet" cx="50%" cy="45%" r="58%">
            <stop offset="0%" stopColor="#a44dff" stopOpacity="0.42" />
            <stop offset="54%" stopColor="#5b238f" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#080818" stopOpacity="0" />
          </radialGradient>
        </defs>
        {theme !== 'light' && (
          <circle cx="1230" cy="560" r="174" fill="url(#cult-dark-planet)" opacity="0.82" />
        )}
        <path d="M-120 420 C 210 130, 450 140, 740 320 S 1170 560, 1560 180" fill="none" stroke="url(#cult-scene-line)" strokeWidth="1" />
        <path d="M-80 520 C 260 250, 520 300, 820 430 S 1130 570, 1510 360" fill="none" stroke="url(#cult-scene-line)" strokeWidth="0.8" opacity="0.78" />
        <path d="M780 -120 C 930 120, 1070 230, 1520 270" fill="none" stroke="url(#cult-scene-line)" strokeWidth="1" opacity="0.55" />
        {theme !== 'light' && Array.from({ length: 11 }).map((_, i) => (
          <path
            key={i}
            d={`M760 ${260 + i * 14} C 940 ${170 + i * 6}, 1120 ${190 + i * 10}, 1500 ${80 + i * 18}`}
            fill="none"
            stroke="url(#cult-scene-line)"
            strokeWidth="0.45"
            opacity={0.22 - i * 0.012}
          />
        ))}
      </svg>

      {/* Animated accent grain */}
      <canvas
        ref={grainRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          mixBlendMode: theme === 'light' ? 'soft-light' : 'screen',
          opacity: theme === 'light' ? 0.34 : 0.6,
        }}
      />
    </div>
  )
}
