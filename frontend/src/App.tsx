import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

import Home from './pages/Home'
import CreatorPage from './pages/CreatorPage'
import Dashboard from './pages/Dashboard'
import Explore from './pages/Explore'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import Notifications from './pages/Notifications'
import FanProfile from './pages/FanProfile'
import { useStore } from './lib/store'
import { readPushEnabled } from './lib/push'

export default function App() {
  const theme = useStore((state) => state.theme)
  const setPushEnabled = useStore((state) => state.setPushEnabled)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    setPushEnabled(readPushEnabled())
  }, [setPushEnabled])

  return (
    <AptosWalletAdapterProvider
      autoConnect
      dappConfig={{
        network: Network.TESTNET,
      }}
      onError={(error) => {
        console.error('wallet adapter error', error)
      }}
    >
      <HashRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
            },
          }}
        />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/u/:handle" element={<CreatorPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/fan/:address" element={<FanProfile />} />
          </Route>
        </Routes>
      </HashRouter>
    </AptosWalletAdapterProvider>
  )
}
