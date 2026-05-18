import { useStore } from '../lib/store'

const ORB_STYLE: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  pointerEvents: 'none',
  transform: 'translate3d(0, 0, 0)',
}

export default function DynamicBackground() {
  const theme = useStore((state) => state.theme)
  const isLight = theme === 'light'

  return (
    <div
      aria-hidden="true"
      className="cult-bg"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        contain: 'strict',
      }}
    >
      <div
        className="cult-bg-orb cult-bg-orb-a"
        style={{
          ...ORB_STYLE,
          width: 'min(58vw, 820px)',
          height: 'min(58vw, 820px)',
          top: '-18%',
          left: '-12%',
          background: isLight
            ? 'radial-gradient(circle, rgba(255,170,121,0.28) 0%, rgba(255,205,171,0.18) 34%, rgba(255,232,214,0.10) 54%, transparent 78%)'
            : 'radial-gradient(circle, rgba(255,112,92,0.38) 0%, rgba(255,112,92,0.16) 34%, rgba(255,87,183,0.055) 58%, transparent 78%)',
          opacity: isLight ? 0.46 : 0.34,
        }}
      />

      <div
        className="cult-bg-orb cult-bg-orb-b"
        style={{
          ...ORB_STYLE,
          width: 'min(54vw, 760px)',
          height: 'min(54vw, 760px)',
          bottom: '-14%',
          right: '-10%',
          background: isLight
            ? 'radial-gradient(circle, rgba(179,150,255,0.26) 0%, rgba(211,188,255,0.16) 34%, rgba(236,226,255,0.10) 52%, transparent 76%)'
            : 'radial-gradient(circle, rgba(130,64,255,0.42) 0%, rgba(255,87,183,0.16) 38%, rgba(63,26,150,0.10) 58%, transparent 74%)',
          opacity: isLight ? 0.32 : 0.28,
        }}
      />

      <div
        className="cult-bg-orb cult-bg-orb-c"
        style={{
          ...ORB_STYLE,
          width: 'min(38vw, 560px)',
          height: 'min(38vw, 560px)',
          top: '39%',
          left: '18%',
          background: isLight
            ? 'radial-gradient(circle, rgba(255,168,224,0.16) 0%, rgba(254,119,201,0.09) 36%, rgba(255,214,239,0.06) 54%, transparent 76%)'
            : 'radial-gradient(circle, rgba(255,87,183,0.16) 0%, rgba(129,75,255,0.10) 42%, rgba(20,18,70,0.08) 58%, transparent 74%)',
          opacity: isLight ? 0.26 : 0.18,
        }}
      />

      {isLight && <div className="cult-bg-lightwash" />}

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        className="cult-bg-lines"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: isLight ? 0.28 : 0.4 }}
      >
        <defs>
          <linearGradient id="cult-scene-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={isLight ? '#f0b98f' : '#ff765f'} stopOpacity={isLight ? '0.34' : '0.30'} />
            <stop offset="48%" stopColor={isLight ? '#ffffff' : '#ff57b7'} stopOpacity={isLight ? '0.14' : '0.18'} />
            <stop offset="100%" stopColor={isLight ? '#b99cff' : '#8f56ff'} stopOpacity={isLight ? '0.38' : '0.38'} />
          </linearGradient>
          <radialGradient id="cult-dark-planet" cx="50%" cy="45%" r="58%">
            <stop offset="0%" stopColor="#a44dff" stopOpacity="0.36" />
            <stop offset="54%" stopColor="#5b238f" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#080818" stopOpacity="0" />
          </radialGradient>
        </defs>
        {!isLight && <circle cx="1230" cy="560" r="174" fill="url(#cult-dark-planet)" opacity="0.74" />}
        <path d="M-120 420 C 210 130, 450 140, 740 320 S 1170 560, 1560 180" fill="none" stroke="url(#cult-scene-line)" strokeWidth="1" />
        <path d="M-80 520 C 260 250, 520 300, 820 430 S 1130 570, 1510 360" fill="none" stroke="url(#cult-scene-line)" strokeWidth="0.8" opacity="0.72" />
        <path d="M780 -120 C 930 120, 1070 230, 1520 270" fill="none" stroke="url(#cult-scene-line)" strokeWidth="1" opacity="0.48" />
        {!isLight && Array.from({ length: 7 }).map((_, i) => (
          <path
            key={i}
            d={`M760 ${260 + i * 18} C 940 ${170 + i * 7}, 1120 ${190 + i * 12}, 1500 ${80 + i * 22}`}
            fill="none"
            stroke="url(#cult-scene-line)"
            strokeWidth="0.45"
            opacity={0.18 - i * 0.014}
          />
        ))}
      </svg>

      <div className="cult-bg-grain" />
    </div>
  )
}
