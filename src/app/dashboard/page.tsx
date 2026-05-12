'use client'

import { useAppStore, type Page } from '@/lib/store'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Target,
  Building2,
  BookText,
  Puzzle,
  HelpCircle,
  AlertTriangle,
  SlidersHorizontal,
  Search,
  X,
  ChevronUp,
  MapPin,
  Phone,
  User,
  LogOut,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DashboardPage from '@/components/dashboard-page'
import ConversationsPage from '@/components/conversations-page'
import SettingsPage from '@/components/settings-page'
import LeadsPage from '@/components/leads-page'
import ClinicProfilePage from '@/components/clinic-profile-page'
import KnowledgeBasePage from '@/components/knowledge-base-page'
import WidgetInstallPage from '@/components/widget-install-page'
import FAQPage from '@/components/faq-page'
import UnansweredQuestionsPage from '@/components/unanswered-questions-page'
import CustomizationsPage from '@/components/customizations-page'

interface NavItem {
  page: Page
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Core',
    items: [
      { page: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Training',
    items: [
      { page: 'clinic-profile', label: 'Bot Setup', icon: Building2 },
      { page: 'knowledge-base', label: 'Knowledge Sources', icon: BookText },
      { page: 'faq', label: 'FAQ Builder', icon: HelpCircle },
    ],
  },
  {
    label: 'Conversations',
    items: [
      { page: 'conversations', label: 'Inbox', icon: MessageSquare },
      { page: 'leads', label: 'Leads', icon: Target },
      { page: 'unanswered-questions', label: 'Unanswered Inbox', icon: AlertTriangle },
    ],
  },
  {
    label: 'Deploy',
    items: [
      { page: 'widget-install', label: 'Widget & Install', icon: Puzzle },
      { page: 'customizations', label: 'Customizations', icon: SlidersHorizontal },
      { page: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const pageTitles: Record<Page, string> = {
  dashboard: 'Overview',
  conversations: 'Conversation Inbox',
  leads: 'Leads',
  'unanswered-questions': 'Unanswered Questions',
  'clinic-profile': 'Bot Setup',
  'knowledge-base': 'Knowledge Sources',
  faq: 'FAQ Builder',
  'widget-install': 'Widget & Install',
  customizations: 'Customizations',
  settings: 'Settings',
}

interface ClinicProfile {
  id: string
  name: string
  address: string
  city: string
  primaryPhone: string
  isActive: boolean
}

export default function Home() {
  const router = useRouter()
  const { activePage, setActivePage } = useAppStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [clinic, setClinic] = useState<ClinicProfile | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    // Auth is now handled by middleware + Supabase session
    // No need for client-side localStorage checks
    async function loadClinic() {
      try {
        const res = await fetch('/api/clinic', { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          if (isActive) {
            setClinic(data)
          }
        }
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') {
          return
        }
        // silent
      }
    }
    void loadClinic()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [router])

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  const clinicInitials = clinic?.name
    ? clinic.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'DR'

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />
      case 'conversations':
        return <ConversationsPage />
      case 'leads':
        return <LeadsPage />
      case 'unanswered-questions':
        return <UnansweredQuestionsPage />
      case 'clinic-profile':
        return <ClinicProfilePage />
      case 'knowledge-base':
        return <KnowledgeBasePage />
      case 'faq':
        return <FAQPage />
      case 'widget-install':
        return <WidgetInstallPage />
      case 'customizations':
        return <CustomizationsPage />
      case 'settings':
        return <SettingsPage />
    }
  }

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-emerald-100/80 bg-gradient-to-b from-white via-emerald-50/30 to-white">
        <SidebarHeader className="border-b border-emerald-100/80 px-3 py-3">
          <div className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-sm">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold tracking-tight text-slate-900">DentalGPT Studio</p>
                <p className="truncate text-xs text-slate-500">AI Front Desk Control Center</p>
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-1 px-2 py-3">
          {navGroups.map((group) => (
            <SidebarGroup key={group.label} className="py-0.5">
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.page}>
                    <SidebarMenuButton
                      isActive={activePage === item.page}
                      onClick={() => setActivePage(item.page)}
                      tooltip={item.label}
                      className={
                        activePage === item.page
                          ? 'h-10 rounded-xl bg-black text-slate-900 font-semibold hover:bg-black focus-visible:bg-black active:bg-black [&>span:first-child]:bg-emerald-50 [&>span:first-child]:text-emerald-700'
                          : 'h-10 rounded-xl text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 [&>span:first-child]:bg-emerald-50/60 [&>span:first-child]:text-emerald-600'
                      }
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors">
                        <item.icon className="size-3.5" />
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-emerald-100/80 bg-white/80 p-3 backdrop-blur-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-emerald-100 bg-white px-2.5 py-2.5 text-left shadow-sm transition-colors hover:bg-emerald-50/60"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                    {clinicInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{clinic?.name || 'Loading...'}</p>
                  <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                    <span className="inline-flex size-1.5 rounded-full bg-emerald-500" />
                    {clinic?.city || 'Clinic Profile'}
                  </p>
                </div>
                <ChevronUp className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="w-56" align="start">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{clinic?.name || 'Clinic'}</p>
                  {clinic?.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3" />
                      {clinic.city}
                    </p>
                  )}
                  {clinic?.primaryPhone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="size-3" />
                      {clinic.primaryPhone}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActivePage('clinic-profile')}>
                <User className="mr-2 size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="mr-2 size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="min-h-screen flex flex-col">
          <header className="flex h-13 items-center gap-3 border-b bg-white px-3 sm:px-4">
            <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center" />
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <h1 className="font-semibold text-sm tracking-tight hidden sm:block">{pageTitles[activePage]}</h1>
            {/* Mobile title - shown on small screens */}
            <h1 className="font-semibold text-sm tracking-tight sm:hidden truncate">{pageTitles[activePage]}</h1>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {/* Mobile: search icon toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 md:hidden"
                onClick={() => { setSearchOpen(!searchOpen); setSearchQuery('') }}
              >
                {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
              </Button>
              {/* Desktop: always-visible search */}
              <Input placeholder="Search..." className="h-8 w-48 text-sm hidden md:block md:w-64" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hidden sm:flex">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium">
                        {clinicInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium">{clinic?.name || 'Clinic'}</p>
                    <p className="text-xs text-muted-foreground">{clinic?.city || ''}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActivePage('clinic-profile')}>
                    <User className="mr-2 size-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-2 size-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          {/* Mobile search bar - expandable */}
          {searchOpen && (
            <div className="border-b bg-white px-3 py-2 md:hidden">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-sm"
                autoFocus
              />
            </div>
          )}
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
            {renderPage()}
          </main>
          <footer className="mt-auto border-t bg-white px-4 py-2.5 text-center text-xs text-muted-foreground safe-bottom">
            &copy; 2026 DentalGPT Studio
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
