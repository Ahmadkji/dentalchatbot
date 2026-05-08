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
import { Bot, LayoutDashboard, MessageSquare, Users, Calendar, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import DashboardPage from '@/components/dashboard-page'
import ConversationsPage from '@/components/conversations-page'
import PatientsPage from '@/components/patients-page'
import AppointmentsPage from '@/components/appointments-page'
import ChatPage from '@/components/chat-page'
import SettingsPage from '@/components/settings-page'

const navItems: { page: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'conversations', label: 'Conversations', icon: MessageSquare },
  { page: 'patients', label: 'Patients', icon: Users },
  { page: 'appointments', label: 'Appointments', icon: Calendar },
  { page: 'chat', label: 'AI Chat', icon: Bot },
  { page: 'settings', label: 'Settings', icon: Settings },
]

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  conversations: 'Conversations',
  patients: 'Patients',
  appointments: 'Appointments',
  chat: 'AI Chat',
  settings: 'Settings',
}

export default function Home() {
  const { activePage, setActivePage } = useAppStore()

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />
      case 'conversations':
        return <ConversationsPage />
      case 'patients':
        return <PatientsPage />
      case 'appointments':
        return <AppointmentsPage />
      case 'chat':
        return <ChatPage />
      case 'settings':
        return <SettingsPage />
    }
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Bot className="size-4" />
            </div>
            <span className="font-semibold text-base tracking-tight">DentBot</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.page}>
                  <SidebarMenuButton
                    isActive={activePage === item.page}
                    onClick={() => setActivePage(item.page)}
                    tooltip={item.label}
                    className={
                      activePage === item.page
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800'
                        : ''
                    }
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t">
          <div className="px-2 py-1 text-xs text-muted-foreground">
            BrightSmile Dental
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="min-h-screen flex flex-col">
          <header className="flex h-13 items-center gap-3 border-b bg-white px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-5" />
            <h1 className="font-semibold text-sm tracking-tight">{pageTitles[activePage]}</h1>
            <div className="ml-auto flex items-center gap-3">
              <Input placeholder="Search..." className="h-8 w-48 text-sm md:w-64" />
              <Avatar className="size-7">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium">
                  DR
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            {renderPage()}
          </main>
          <footer className="mt-auto border-t bg-white px-4 py-2.5 text-center text-xs text-muted-foreground">
            &copy; 2024 DentBot AI Assistant
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
