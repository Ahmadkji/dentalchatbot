'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode, type ComponentType } from 'react'
import { ClinicProvider, useClinicContext } from '@/lib/contexts/clinic-context'
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
  CreditCard,
  Target,
  Building2,
  BookText,
  Puzzle,
  Stethoscope,
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
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  dashboardRoutes,
  getDashboardTitle,
  isActiveDashboardPath,
  type DashboardPath,
} from '@/lib/dashboard-routes'

interface NavItem {
  href: DashboardPath
  label: string
  icon: ComponentType<{ className?: string }>
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Core',
    items: [
      { href: dashboardRoutes.overview, label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Training',
    items: [
      { href: dashboardRoutes.botSetup, label: 'Bot Setup', icon: Building2 },
      { href: dashboardRoutes.services, label: 'Services & Pricing', icon: Stethoscope },
      { href: dashboardRoutes.knowledge, label: 'Knowledge Sources', icon: BookText },
      { href: dashboardRoutes.faq, label: 'FAQ Builder', icon: HelpCircle },
    ],
  },
  {
    label: 'Conversations',
    items: [
      { href: dashboardRoutes.inbox, label: 'Inbox', icon: MessageSquare },
      { href: dashboardRoutes.leads, label: 'Leads', icon: Target },
      { href: dashboardRoutes.unanswered, label: 'Unanswered Inbox', icon: AlertTriangle },
    ],
  },
  {
    label: 'Deploy',
    items: [
      { href: dashboardRoutes.widget, label: 'Widget & Install', icon: Puzzle },
      { href: dashboardRoutes.billing, label: 'Payments', icon: CreditCard },
      { href: dashboardRoutes.customizations, label: 'Customizations', icon: SlidersHorizontal },
      { href: dashboardRoutes.settings, label: 'Settings', icon: Settings },
    ],
  },
]

/**
 * Inner shell that consumes the shared ClinicContext.
 * Wrapped by ClinicProvider below so the context is available.
 */
function DashboardShellInner({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { clinic, loading: clinicLoading } = useClinicContext()

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  const clinicInitials = clinic?.name
    ? clinic.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'DR'

  const title = getDashboardTitle(pathname)

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
                {group.items.map((item) => {
                  const active = isActiveDashboardPath(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={
                          active
                            ? 'h-10 rounded-xl bg-black text-slate-900 font-semibold hover:bg-black focus-visible:bg-black active:bg-black [&>span:first-child]:bg-emerald-50 [&>span:first-child]:text-emerald-700'
                            : 'h-10 rounded-xl text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 [&>span:first-child]:bg-emerald-50/60 [&>span:first-child]:text-emerald-600'
                        }
                      >
                        <Link href={item.href}>
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors">
                            <item.icon className="size-3.5" />
                          </span>
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
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
                  <div className="text-xs font-medium truncate">
                    {clinicLoading ? <Skeleton className="h-3.5 w-24" /> : (clinic?.name || 'Clinic')}
                  </div>
                  {clinic?.city ? (
                    <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                      <span className="inline-flex size-1.5 rounded-full bg-emerald-500" />
                      {clinic.city}
                    </p>
                  ) : null}
                </div>
                <ChevronUp className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="w-56" align="start">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{clinicLoading ? <Skeleton className="h-4 w-28" /> : (clinic?.name || 'Clinic')}</p>
                  {clinic?.city ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3" />
                      {clinic.city}
                    </p>
                  ) : null}
                  {clinic?.primaryPhone ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="size-3" />
                      {clinic.primaryPhone}
                    </p>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(dashboardRoutes.profile)}>
                <User className="mr-2 size-4" />
                My Profile
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
            <h1 className="font-semibold text-sm tracking-tight hidden sm:block">{title}</h1>
            <h1 className="font-semibold text-sm tracking-tight sm:hidden truncate">{title}</h1>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 md:hidden"
                onClick={() => { setSearchOpen(!searchOpen); setSearchQuery('') }}
              >
                {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
              </Button>
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
                    <p className="text-sm font-medium">{clinicLoading ? <Skeleton className="h-4 w-28" /> : (clinic?.name || 'Clinic')}</p>
                    <p className="text-xs text-muted-foreground">{clinic?.city || ''}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(dashboardRoutes.profile)}>
                    <User className="mr-2 size-4" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-2 size-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
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
            {children}
          </main>
          <footer className="mt-auto border-t bg-white px-4 py-2.5 text-center text-xs text-muted-foreground safe-bottom">
            &copy; 2026 DentalGPT Studio
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * Public export — wraps the inner shell with ClinicProvider so every
 * dashboard page can call useClinicContext().
 */
export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <ClinicProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </ClinicProvider>
  )
}
