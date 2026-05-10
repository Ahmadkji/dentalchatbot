import { create } from 'zustand'

export type Page =
  | 'dashboard'
  | 'conversations'
  | 'leads'
  | 'unanswered-questions'
  | 'clinic-profile'
  | 'knowledge-base'
  | 'faq'
  | 'widget-install'
  | 'customizations'
  | 'settings'

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
