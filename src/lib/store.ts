import { create } from 'zustand'

export type Page = 'dashboard' | 'conversations' | 'patients' | 'appointments' | 'chat' | 'services' | 'doctors' | 'leads' | 'appointment-requests' | 'faq' | 'settings'

interface AppStore {
  activePage: Page
  setActivePage: (page: Page) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
