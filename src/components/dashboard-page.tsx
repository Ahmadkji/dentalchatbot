'use client'

import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, MessageSquare, Calendar, CheckCircle, Target, CalendarClock, Stethoscope, UserCog } from 'lucide-react'
import { useAppStore } from '@/lib/store'

interface DashboardStats {
  totalPatients: number
  activeConversations: number
  todayAppointments: number
  completedToday: number
  pendingLeads: number
  pendingAppointmentRequests: number
  activeServices: number
  activeDoctors: number
}

interface Appointment {
  id: string
  patientName: string
  time: string
  duration: number
  type: string
  status: string
  notes: string
}

interface Conversation {
  id: string
  patientName: string
  channel: string
  subject: string
  messageCount: number
  lastMessage: string
  status: string
  createdAt: string
}

interface Patient {
  id: string
  name: string
  email: string
  phone: string
  lastVisit: string
  status: string
}

interface Lead {
  id: string
  name: string
  phone: string
  question: string
  preferredContact: string
  status: string
  createdAt: string
}

interface AppointmentRequest {
  id: string
  name: string
  phone: string
  preferredDate: string
  preferredTime: string
  reason: string
  status: string
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    closed: 'bg-gray-50 text-gray-600 border-gray-200',
    new: 'bg-sky-50 text-sky-700 border-sky-200',
    inactive: 'bg-gray-50 text-gray-600 border-gray-200',
    contacted: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${variants[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function TableSkeleton({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export default function DashboardPage() {
  const { setActivePage } = useAppStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [pendingLeads, setPendingLeads] = useState<Lead[]>([])
  const [pendingRequests, setPendingRequests] = useState<AppointmentRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [statsRes, apptsRes, convRes, patientsRes, leadsRes, reqRes] = await Promise.allSettled([
          fetch('/api/dashboard'),
          fetch('/api/appointments?date=today'),
          fetch('/api/conversations'),
          fetch('/api/patients'),
          fetch('/api/leads?status=new'),
          fetch('/api/appointment-requests?status=pending'),
        ])

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const data = await statsRes.value.json()
          setStats(data.stats || data)
        }
        if (apptsRes.status === 'fulfilled' && apptsRes.value.ok) {
          const data = await apptsRes.value.json()
          setAppointments(data.appointments || data || [])
        }
        if (convRes.status === 'fulfilled' && convRes.value.ok) {
          const data = await convRes.value.json()
          setConversations(data.conversations || data || [])
        }
        if (patientsRes.status === 'fulfilled' && patientsRes.value.ok) {
          const data = await patientsRes.value.json()
          setPatients((data.patients || data || []).slice(0, 5))
        }
        if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
          const data = await leadsRes.value.json()
          setPendingLeads(Array.isArray(data) ? data : (data.leads || []))
        }
        if (reqRes.status === 'fulfilled' && reqRes.value.ok) {
          const data = await reqRes.value.json()
          setPendingRequests(Array.isArray(data) ? data : (data.appointmentRequests || []))
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const statRows = stats
    ? [
        { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'text-emerald-600' },
        { label: 'Active Conversations', value: stats.activeConversations, icon: MessageSquare, color: 'text-sky-600' },
        { label: "Today's Appointments", value: stats.todayAppointments, icon: Calendar, color: 'text-amber-600' },
        { label: 'Completed Today', value: stats.completedToday, icon: CheckCircle, color: 'text-emerald-600' },
        { label: 'Pending Leads', value: stats.pendingLeads, icon: Target, color: 'text-sky-600' },
        { label: 'Pending Appt Requests', value: stats.pendingAppointmentRequests, icon: CalendarClock, color: 'text-amber-600' },
        { label: 'Active Services', value: stats.activeServices, icon: Stethoscope, color: 'text-emerald-600' },
        { label: 'Active Doctors', value: stats.activeDoctors, icon: UserCog, color: 'text-emerald-600' },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Summary Stats Table */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Overview</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Metric</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={8} cols={2} />
              ) : statRows.length > 0 ? (
                statRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <row.icon className={`size-4 ${row.color}`} />
                        <span className="text-sm">{row.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">{row.value}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                    No stats available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Pending Leads Table */}
      {!loading && pendingLeads.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">Pending Leads</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:text-emerald-700" onClick={() => setActivePage('leads')}>
              View All →
            </Button>
          </div>
          <div className="rounded-md border max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Question</TableHead>
                  <TableHead>Preferred Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLeads.slice(0, 5).map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium text-sm">{lead.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {lead.question || '—'}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{lead.preferredContact}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell><StatusBadge status={lead.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Pending Appointment Requests Table */}
      {!loading && pendingRequests.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">Pending Appointment Requests</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:text-emerald-700" onClick={() => setActivePage('appointment-requests')}>
              View All →
            </Button>
          </div>
          <div className="rounded-md border max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Preferred Date</TableHead>
                  <TableHead>Preferred Time</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.slice(0, 5).map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium text-sm">{req.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{req.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{req.preferredDate}</TableCell>
                    <TableCell className="text-sm tabular-nums">{req.preferredTime || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {req.reason || '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Today's Appointments */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Today&apos;s Appointments</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={3} cols={6} />
              ) : appointments.length > 0 ? (
                appointments.map((appt) => (
                  <TableRow key={appt.id}>
                    <TableCell className="font-medium">{appt.patientName}</TableCell>
                    <TableCell className="tabular-nums">{appt.time}</TableCell>
                    <TableCell>{appt.duration} min</TableCell>
                    <TableCell>{appt.type}</TableCell>
                    <TableCell><StatusBadge status={appt.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                      {appt.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No appointments today
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Recent Conversations */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Conversations</h2>
        <div className="rounded-md border max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="hidden md:table-cell">Subject</TableHead>
                <TableHead className="text-center">Messages</TableHead>
                <TableHead className="hidden lg:table-cell">Last Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : conversations.length > 0 ? (
                conversations.slice(0, 6).map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="font-medium">{conv.patientName}</TableCell>
                    <TableCell className="text-muted-foreground">{conv.channel}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground max-w-[180px] truncate">
                      {conv.subject || '—'}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{conv.messageCount}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate text-xs">
                      {conv.lastMessage || '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={conv.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {conv.createdAt ? new Date(conv.createdAt).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No recent conversations
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* New Patients */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Patients</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={3} cols={5} />
              ) : patients.length > 0 ? (
                patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{patient.email}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{patient.phone}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={patient.status} /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No patients found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
