import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import Home from './pages/Home'
import CreatorPage from './pages/CreatorPage'
import Dashboard from './pages/Dashboard'
import Explore from './pages/Explore'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import Notifications from './pages/Notifications'
import FanProfile from './pages/FanProfile'

export default function App() {
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
              background: '#0a0a0a',
              color: '#f0ece3',
              border: '1px solid #2a2520',
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
