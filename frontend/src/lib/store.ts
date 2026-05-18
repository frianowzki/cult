import { create } from 'zustand'
import type { CreatorProfile, Content } from './aptos'

type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'cult:theme'

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    return 'light'
  } catch {
    return 'light'
  }
}

interface AppState {
  pushEnabled: boolean
  setPushEnabled: (enabled: boolean) => void
  currentCreator: CreatorProfile | null
  currentCreatorContent: Content[]
  setCurrentCreator: (p: CreatorProfile | null) => void
  setCurrentCreatorContent: (c: Content[]) => void

  subscriptionStatus: { isActive: boolean; tierIndex: number; expiresAt: number } | null
  setSubscriptionStatus: (s: AppState['subscriptionStatus']) => void

  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void

  uploadModalOpen: boolean
  setUploadModalOpen: (v: boolean) => void

  registerModalOpen: boolean
  setRegisterModalOpen: (v: boolean) => void

  userProfileModalOpen: boolean
  setUserProfileModalOpen: (v: boolean) => void

  tipModalOpen: boolean
  tipTarget: string | null
  openTipModal: (creatorAddr: string) => void
  closeTipModal: () => void
}

export const useStore = create<AppState>((set) => ({
  pushEnabled: false,
  setPushEnabled: (enabled) => set({ pushEnabled: enabled }),
  currentCreator: null,
  currentCreatorContent: [],
  setCurrentCreator: (p) => set({ currentCreator: p }),
  setCurrentCreatorContent: (c) => set({ currentCreatorContent: c }),

  subscriptionStatus: null,
  setSubscriptionStatus: (s) => set({ subscriptionStatus: s }),

  theme: readInitialTheme(),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, theme) } catch {}
    }
    set({ theme })
  },
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark'
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme) } catch {}
    }
    return { theme: nextTheme }
  }),

  uploadModalOpen: false,
  setUploadModalOpen: (v) => set({ uploadModalOpen: v }),

  registerModalOpen: false,
  setRegisterModalOpen: (v) => set({ registerModalOpen: v }),

  userProfileModalOpen: false,
  setUserProfileModalOpen: (v) => set({ userProfileModalOpen: v }),

  tipModalOpen: false,
  tipTarget: null,
  openTipModal: (creatorAddr) => set({ tipModalOpen: true, tipTarget: creatorAddr }),
  closeTipModal: () => set({ tipModalOpen: false, tipTarget: null }),
}))
