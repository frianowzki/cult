import { useEffect, useRef } from 'react'

const ORB_STYLE: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(120px)',
  pointerEvents: 'none',
  willChange: 'transform, opacity',
}

export default function DynamicBackground() {
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
          background: 'radial-gradient(circle, rgba(254,119,201,0.34) 0%, rgba(254,119,201,0.14) 42%, rgba(184,79,144,0.08) 58%, transparent 74%)',
          opacity: 0.32,
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
          background: 'radial-gradient(circle, rgba(184,79,144,0.28) 0%, rgba(254,119,201,0.12) 38%, rgba(120,36,86,0.08) 58%, transparent 72%)',
          opacity: 0.22,
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
          background: 'radial-gradient(circle, rgba(255,168,224,0.18) 0%, rgba(254,119,201,0.1) 42%, rgba(184,79,144,0.06) 58%, transparent 72%)',
          opacity: 0.18,
        }}
      />

      {/* Animated accent grain */}
      <canvas
        ref={grainRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          mixBlendMode: 'screen',
          opacity: 0.6,
        }}
      />
    </div>
  )
}
