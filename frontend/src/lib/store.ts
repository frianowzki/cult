import { create } from 'zustand'
import type { CreatorProfile, Content } from './aptos'

interface AppState {
  currentCreator: CreatorProfile | null
  currentCreatorContent: Content[]
  setCurrentCreator: (p: CreatorProfile | null) => void
  setCurrentCreatorContent: (c: Content[]) => void

  subscriptionStatus: { isActive: boolean; tierIndex: number; expiresAt: number } | null
  setSubscriptionStatus: (s: AppState['subscriptionStatus']) => void

  uploadModalOpen: boolean
  setUploadModalOpen: (v: boolean) => void

  registerModalOpen: boolean
  setRegisterModalOpen: (v: boolean) => void

  tipModalOpen: boolean
  tipTarget: string | null
  openTipModal: (creatorAddr: string) => void
  closeTipModal: () => void
}

export const useStore = create<AppState>((set) => ({
  currentCreator: null,
  currentCreatorContent: [],
  setCurrentCreator: (p) => set({ currentCreator: p }),
  setCurrentCreatorContent: (c) => set({ currentCreatorContent: c }),

  subscriptionStatus: null,
  setSubscriptionStatus: (s) => set({ subscriptionStatus: s }),

  uploadModalOpen: false,
  setUploadModalOpen: (v) => set({ uploadModalOpen: v }),

  registerModalOpen: false,
  setRegisterModalOpen: (v) => set({ registerModalOpen: v }),

  tipModalOpen: false,
  tipTarget: null,
  openTipModal: (creatorAddr) => set({ tipModalOpen: true, tipTarget: creatorAddr }),
  closeTipModal: () => set({ tipModalOpen: false, tipTarget: null }),
}))
