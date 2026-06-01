'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

type BillingFeatures = {
  canUseWidget: boolean
  canUseAiChat: boolean
  canCaptureLeads: boolean
  canCreateAppointmentRequests: boolean
  canUseAfterHoursCapture: boolean
  canAccessAdvancedInsights: boolean
}

type BillingStatusResponse = {
  clinicId: string
  membershipRole: 'owner' | 'admin' | 'staff' | null
  billing: {
    state: 'free' | 'pending' | 'trial' | 'active' | 'canceled' | 'expired'
    isActive: boolean
    features: BillingFeatures
    pricingId: string | null
    planId: string | null
    expiration: string | null
    trialEndsAt: string | null
    currency: string | null
    amount: number | null
    billingCycle: string | null
    isCanceled: boolean
    lastSyncedAt: string | null
  }
  defaultPlanId: string | null
  returnUrl: string
  webhookUrl: string
  dashboardUrl: string
}

function formatState(state: BillingStatusResponse['billing']['state']) {
  switch (state) {
    case 'active':
      return 'Active'
    case 'trial':
      return 'Trial'
    case 'canceled':
      return 'Canceled'
    case 'expired':
      return 'Expired'
    case 'pending':
      return 'Pending'
    default:
      return 'Free'
  }
}

function formatFeature(enabled: boolean) {
  return enabled ? 'Enabled' : 'Not included'
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const canStartCheckout =
    status?.membershipRole === 'owner' || status?.membershipRole === 'admin'

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/billing/freemius/status', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load billing status')
      }

      const data = (await response.json()) as BillingStatusResponse
      setStatus(data)
    } catch {
      setStatus(null)
      toast.error('Failed to load billing status')
    } finally {
      setLoading(false)
    }
  }, [])

  const openCheckout = async (options?: { isSandbox?: boolean; trialMode?: 'free' | 'paid' | null }) => {
    if (!status?.defaultPlanId) {
      toast.error('Freemius plan is not configured yet.')
      return
    }

    if (!canStartCheckout) {
      toast.error('Only owner or admin can start checkout.')
      return
    }

    setCheckoutLoading(true)
    try {
      const response = await fetch('/api/billing/freemius/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: status.defaultPlanId,
          trialMode: options?.trialMode ?? null,
          isSandbox: options?.isSandbox ?? false,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        url?: string
        error?: string
        reused?: boolean
      }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Failed to create checkout link')
      }

      if (payload.reused) {
        toast.success('Reopened existing checkout link')
      }

      window.open(payload.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open checkout')
    } finally {
      setCheckoutLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const billingParam = searchParams.get('billing')
    if (!billingParam) return

    if (billingParam === 'success') {
      toast.success('Billing synced successfully')
    } else if (billingParam === 'received') {
      toast('Payment received. Webhook sync is still finishing.')
    } else if (billingParam === 'invalid') {
      toast.error('Freemius redirect validation failed')
    } else if (billingParam === 'error') {
      toast.error('Failed to process Freemius redirect')
    }

    searchParams.delete('billing')
    const nextSearch = searchParams.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Manage plan status, checkout, and Freemius integration endpoints for this clinic.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Plan Status</CardTitle>
          <CardDescription>Current plan, entitlement state, and checkout actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : status ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    status.billing.isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-100 text-slate-700'
                  }
                >
                  {formatState(status.billing.state)}
                </Badge>
                {status.billing.planId ? (
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                    Plan {status.billing.planId}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                  Role: {status.membershipRole ?? 'unknown'}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => void openCheckout()}
                  disabled={!canStartCheckout || checkoutLoading || !status.defaultPlanId}
                >
                  {checkoutLoading ? 'Opening...' : 'Open Production Checkout'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void openCheckout({ isSandbox: true })}
                  disabled={!canStartCheckout || checkoutLoading || !status.defaultPlanId}
                >
                  Sandbox Checkout
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void openCheckout({ isSandbox: true, trialMode: 'paid' })}
                  disabled={!canStartCheckout || checkoutLoading || !status.defaultPlanId}
                >
                  Sandbox Trial
                </Button>
              </div>

              {!canStartCheckout ? (
                <p className="text-xs text-amber-700">
                  You can view billing details, but only owner/admin can start checkout.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-600">Billing status is currently unavailable.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Feature Access</CardTitle>
          <CardDescription>What this clinic can use based on current entitlement.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Capability</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || !status ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : (
                <>
                  <TableRow>
                    <TableCell>Widget Embed</TableCell>
                    <TableCell>{formatFeature(status.billing.features.canUseWidget)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>AI Chat</TableCell>
                    <TableCell>{formatFeature(status.billing.features.canUseAiChat)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Lead Capture</TableCell>
                    <TableCell>{formatFeature(status.billing.features.canCaptureLeads)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Appointment Requests</TableCell>
                    <TableCell>{formatFeature(status.billing.features.canCreateAppointmentRequests)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>After-Hours Capture</TableCell>
                    <TableCell>{formatFeature(status.billing.features.canUseAfterHoursCapture)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Advanced Insights</TableCell>
                    <TableCell>{formatFeature(status.billing.features.canAccessAdvancedInsights)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Freemius Endpoints</CardTitle>
          <CardDescription>Use these exact URLs in your Freemius dashboard configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="break-all"><span className="font-medium">Redirect URL:</span> {status?.returnUrl ?? 'Unavailable'}</p>
          <p className="break-all"><span className="font-medium">Webhook URL:</span> {status?.webhookUrl ?? 'Unavailable'}</p>
        </CardContent>
      </Card>
    </div>
  )
}
