/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS: string
  readonly VITE_PLATFORM_ADDRESS: string
  readonly VITE_SHELBY_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
