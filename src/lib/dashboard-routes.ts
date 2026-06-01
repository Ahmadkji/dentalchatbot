export const dashboardRoutes = {
  overview: '/dashboard',
  profile: '/dashboard/profile',
  inbox: '/dashboard/inbox',
  leads: '/dashboard/leads',
  unanswered: '/dashboard/unanswered',
  botSetup: '/dashboard/bot-setup',
  services: '/dashboard/services',
  knowledge: '/dashboard/knowledge',
  faq: '/dashboard/faq',
  widget: '/dashboard/widget',
  billing: '/dashboard/billing',
  customizations: '/dashboard/customizations',
  settings: '/dashboard/settings',
} as const

export type DashboardPath = (typeof dashboardRoutes)[keyof typeof dashboardRoutes]

const titleMap: Record<DashboardPath, string> = {
  [dashboardRoutes.overview]: 'Overview',
  [dashboardRoutes.profile]: 'My Profile',
  [dashboardRoutes.inbox]: 'Conversation Inbox',
  [dashboardRoutes.leads]: 'Leads',
  [dashboardRoutes.unanswered]: 'Unanswered Questions',
  [dashboardRoutes.botSetup]: 'Bot Setup',
  [dashboardRoutes.services]: 'Services & Pricing',
  [dashboardRoutes.knowledge]: 'Knowledge Sources',
  [dashboardRoutes.faq]: 'FAQ Builder',
  [dashboardRoutes.widget]: 'Widget & Install',
  [dashboardRoutes.billing]: 'Payments',
  [dashboardRoutes.customizations]: 'Customizations',
  [dashboardRoutes.settings]: 'Settings',
}

export function getDashboardTitle(pathname: string): string {
  if (pathname === dashboardRoutes.overview) return titleMap[dashboardRoutes.overview]
  if (pathname.startsWith(dashboardRoutes.profile)) return titleMap[dashboardRoutes.profile]
  if (pathname.startsWith(dashboardRoutes.inbox)) return titleMap[dashboardRoutes.inbox]
  if (pathname.startsWith(dashboardRoutes.leads)) return titleMap[dashboardRoutes.leads]
  if (pathname.startsWith(dashboardRoutes.unanswered)) return titleMap[dashboardRoutes.unanswered]
  if (pathname.startsWith(dashboardRoutes.botSetup)) return titleMap[dashboardRoutes.botSetup]
  if (pathname.startsWith(dashboardRoutes.services)) return titleMap[dashboardRoutes.services]
  if (pathname.startsWith(dashboardRoutes.knowledge)) return titleMap[dashboardRoutes.knowledge]
  if (pathname.startsWith(dashboardRoutes.faq)) return titleMap[dashboardRoutes.faq]
  if (pathname.startsWith(dashboardRoutes.widget)) return titleMap[dashboardRoutes.widget]
  if (pathname.startsWith(dashboardRoutes.billing)) return titleMap[dashboardRoutes.billing]
  if (pathname.startsWith(dashboardRoutes.customizations)) return titleMap[dashboardRoutes.customizations]
  if (pathname.startsWith(dashboardRoutes.settings)) return titleMap[dashboardRoutes.settings]
  return 'Overview'
}

export function isActiveDashboardPath(pathname: string, href: DashboardPath): boolean {
  if (href === dashboardRoutes.overview) return pathname === dashboardRoutes.overview
  return pathname === href || pathname.startsWith(`${href}/`)
}
