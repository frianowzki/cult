import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ color: 'var(--text-dim)', margin: 0 }}>Page not found</p>
      <Link to="/" style={{ color: 'var(--accent)' }}>Go home →</Link>
    </div>
  )
}
