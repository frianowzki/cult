import type { ReactNode } from 'react'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'

interface Props {
  children: ReactNode
}

export default function WalletProvider({ children }: Props) {
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
      {children}
    </AptosWalletAdapterProvider>
  )
}
