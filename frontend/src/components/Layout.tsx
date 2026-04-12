import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import RegisterCreatorModal from './RegisterCreatorModal'
import { useStore } from '../lib/store'
import DynamicBackground from './DynamicBackground'
import NotificationsPopup from './NotificationsPopup'

export default function Layout() {
  const { connected, account, connect, disconnect, wallets } = useWallet()
  const location = useLocation()
  const { setRegisterModalOpen, registerModalOpen } = useStore()
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [walletPickerOpen, setWalletPickerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const walletMenuRef = useRef<HTMLDivElement | null>(null)
  const notifRef = useRef<HTMLDivElement | null>(null)

  const nav = [
    { label: 'Explore', to: '/explore' },
    { label: 'Feed', to: '/feed' },
    { label: 'Dashboard', to: '/dashboard' },
  ]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!notifRef.current) return
      if (!notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!walletMenuRef.current) return
      if (!walletMenuRef.current.contains(e.target as Node)) setWalletMenuOpen(false)
    }
    if (walletMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [walletMenuOpen])

  useEffect(() => {
    function updateMobile() {
      setIsMobile(window.innerWidth <= 640)
    }
    updateMobile()
    window.addEventListener('resize', updateMobile)
    return () => window.removeEventListener('resize', updateMobile)
  }, [])

  const handleConnect = async () => {
    if (!wallets?.length) {
      toast.error('No Aptos wallet detected. Install Petra, Martian, Fewcha, Nightly, or another Aptos wallet.')
      return
    }
    setWalletPickerOpen(true)
  }

  const handleWalletSelect = async (walletName: string) => {
    try {
      await connect(walletName)
      setWalletPickerOpen(false)
    } catch (e) {
      console.error(e)
      toast.error(`Failed to connect ${walletName}`)
    }
  }

  async function handleCopyAddress() {
    if (!account?.address) return
    try {
      await navigator.clipboard.writeText(String(account.address))
      toast.success('Address copied')
      setWalletMenuOpen(false)
    } catch {
      toast.error('Failed to copy address')
    }
  }

  const shortAddr = account?.address
    ? `${String(account.address).slice(0, 6)}…${String(account.address).slice(-4)}`
    : ''

  const bellButton = (
    <div style={{ position: 'relative', flexShrink: 0 }} ref={notifRef}>
      <button
        onClick={() => setNotifOpen((o) => !o)}
        title="Notifications"
        aria-label="Notifications"
        className="btn btn-ghost btn-sm"
        style={{
          minWidth: connected ? undefined : 120,
          height: 30,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: notifOpen ? 'var(--accent)' : 'var(--text-2)',
          cursor: 'pointer',
          padding: connected ? '0 10px' : 0,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>◈</span>
      </button>
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            pointerEvents: 'none',
          }}
        />
      )}
      {notifOpen && (
        <div
          className="card"
          style={isMobile ? {
            position: 'fixed',
            top: 72,
            left: 12,
            right: 12,
            width: 'auto',
            maxWidth: 'none',
            maxHeight: 'calc(100vh - 96px)',
            overflow: 'hidden',
            padding: 0,
            zIndex: 300,
            background: 'var(--bg-2)',
            border: '1px solid var(--border-light)',
          } : {
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 320,
            maxWidth: 'min(320px, calc(100vw - 32px))',
            padding: 0,
            zIndex: 200,
            background: 'var(--bg-2)',
            border: '1px solid var(--border-light)',
          }}
        >
          <NotificationsPopup
            onClose={() => setNotifOpen(false)}
            onUnreadCount={setUnreadCount}
          />
        </div>
      )}
    </div>
  )

  const walletMenu = connected ? (
    <div style={{ position: 'relative' }} ref={walletMenuRef}>
      <button
        className="btn btn-sm"
        onClick={() => setWalletMenuOpen((open) => !open)}
        title={String(account?.address)}
      >
        <span className="mono" style={{ fontSize: 11 }}>{shortAddr}</span>
      </button>
      {walletMenuOpen && (
        <div
          className="card"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            minWidth: 220,
            padding: 8,
            zIndex: 200,
            background: 'var(--bg-2)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Wallet menu
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleCopyAddress}>
            Copy address
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'flex-start', color: '#ff8a8a' }}
            onClick={() => {
              setWalletMenuOpen(false)
              disconnect()
            }}
          >
            Disconnect wallet
          </button>
        </div>
      )}
    </div>
  ) : null

  const walletControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
      {connected && bellButton}
      {connected ? walletMenu : (
        <button className="btn btn-primary btn-sm" onClick={handleConnect}>
          Connect Wallet
        </button>
      )}
    </div>
  )

  return (
    <>
      <DynamicBackground />
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(8, 8, 7, 0.82)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {isMobile ? (
          <nav style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                  CULT
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', letterSpacing: '0.1em', marginTop: 2 }}>
                  ✦ TESTNET
                </span>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {connected && bellButton}
                {walletMenu}
                {!connected && (
                  <button className="btn btn-primary btn-sm" onClick={handleConnect}>
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="btn btn-ghost btn-sm"
                  style={{ color: location.pathname === item.to ? 'var(--accent)' : 'var(--text-2)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : (
          <nav
            style={{
              maxWidth: 1280,
              margin: '0 auto',
              padding: '10px 16px',
              minHeight: 60,
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                CULT
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', letterSpacing: '0.1em', marginTop: 2 }}>
                ✦ TESTNET
              </span>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap', minWidth: 0, overflow: 'hidden' }}>
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="btn btn-ghost btn-sm"
                  style={{ color: location.pathname === item.to ? 'var(--accent)' : 'var(--text-2)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {walletControls}
          </nav>
        )}
      </header>

      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ minHeight: 'calc(100vh - 60px)', position: 'relative', zIndex: 1 }}
      >
        <Outlet />
      </motion.main>

      {registerModalOpen && <RegisterCreatorModal />}

      {walletPickerOpen && (
        <div className="modal-overlay" onClick={() => setWalletPickerOpen(false)}>
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: '100%' }}
          >
            <div className="modal-header">
              <div>
                <div className="section-eyebrow">Wallet</div>
                <h3 style={{ fontWeight: 300 }}>Choose an Aptos wallet</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setWalletPickerOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  className="btn"
                  onClick={() => void handleWalletSelect(wallet.name)}
                  style={{ justifyContent: 'space-between', width: '100%', padding: '12px 14px', minHeight: 52 }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {'icon' in wallet && wallet.icon ? (
                      <img
                        src={wallet.icon}
                        alt={wallet.name}
                        style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--accent)', fontSize: 11, flexShrink: 0 }}>
                        ◌
                      </span>
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{wallet.name}</span>
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>Connect</span>
                </button>
              ))}
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                Supported if installed in your browser: Petra, Martian, Fewcha, Nightly, and other Aptos-standard wallets.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          maxWidth: 1280,
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-3)' }}>CULT</span>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Built on Aptos Testnet · Powered by Shelby Serves</p>
      </footer>
    </>
  )
}
