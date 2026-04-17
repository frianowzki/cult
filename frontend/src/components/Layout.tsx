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
  const isCreatorPage = location.pathname.startsWith('/u/')
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
      <div
        style={{
          minHeight: '100vh',
          height: '100dvh',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          position: 'relative',
        }}
      >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: isCreatorPage
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 18%, rgba(28, 18, 24, 0.12) 48%, rgba(8, 8, 7, 0.06) 100%)'
            : 'linear-gradient(180deg, rgba(26, 18, 24, 0.44) 0%, rgba(14, 11, 14, 0.34) 42%, rgba(8, 8, 7, 0.24) 100%)',
          backdropFilter: isCreatorPage
            ? 'blur(22px) saturate(160%) brightness(1.06)'
            : 'blur(26px) saturate(170%) brightness(1.03)',
          WebkitBackdropFilter: isCreatorPage
            ? 'blur(22px) saturate(160%) brightness(1.06)'
            : 'blur(26px) saturate(170%) brightness(1.03)',
          borderBottom: isCreatorPage
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: isCreatorPage
            ? '0 10px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -1px 0 rgba(255, 255, 255, 0.04)'
            : '0 10px 34px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(254, 119, 201, 0.05)',
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
        style={{ minHeight: 0, position: 'relative', overflow: 'auto' }}
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74, 222, 128, 0.45)' }} />
                    <span>Connect</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      <footer
        style={{
          width: '100%',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'linear-gradient(180deg, rgba(14, 12, 13, 0.58) 0%, rgba(8, 8, 7, 0.74) 100%)',
          backdropFilter: 'blur(18px) saturate(135%)',
          WebkitBackdropFilter: 'blur(18px) saturate(135%)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          padding: isMobile ? '12px 16px calc(12px + env(safe-area-inset-bottom))' : '14px 28px',
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: isMobile ? 'none' : 'minmax(120px, 1fr) auto minmax(260px, 1fr)',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          gap: isMobile ? 10 : 18,
          position: 'relative',
          textAlign: isMobile ? 'center' : 'left',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-3)' }}>CULT</span>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? 18 : 28, flexWrap: 'wrap' }}>
          <a
            href="https://x.com/widyakrnwn"
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              transition: 'var(--transition)',
            }}
          >
            X
          </a>
          <a
            href="https://t.me/widyakrnwn"
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              transition: 'var(--transition)',
            }}
          >
            Telegram
          </a>
          <a
            href="https://github.com/frianowzki/cult"
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              transition: 'var(--transition)',
            }}
          >
            GitHub
          </a>
        </div>

        <p style={{ fontSize: isMobile ? 11 : 12, color: 'var(--text-3)', textAlign: isMobile ? 'center' : 'right', marginTop: isMobile ? 2 : 0, lineHeight: 1.5, maxWidth: isMobile ? 320 : 'none' }}>Built on Aptos Testnet • Powered by Shelby Serves</p>
      </footer>
      </div>
    </>
  )
}
