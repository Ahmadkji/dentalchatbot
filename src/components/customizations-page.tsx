'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import {
  MessageSquareOff,
  MessageCircle,
} from 'lucide-react'
import {
  CUSTOMIZATION_DEFAULTS,
  type CustomizationSettings,
} from '@/lib/customizations/settings'

const defaultSettings: CustomizationSettings = CUSTOMIZATION_DEFAULTS

export default function CustomizationsPage() {
  const [settings, setSettings] = useState<CustomizationSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const settingsRef = useRef(settings)

  // Track whether the first successful load has completed.
  // Used to keep existing data visible during background re-fetches
  // (tab focus, post-mutation refresh) instead of flashing skeletons.
  const hasLoadedRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true)
    try {
      const res = await fetch('/api/customizations')
      if (!res.ok) throw new Error('Failed to load customizations')
      const data = await res.json()
      if (data.settings) {
        const merged = { ...defaultSettings, ...data.settings }
        setSettings(merged)
        settingsRef.current = merged
      }
      hasLoadedRef.current = true
    } catch (error) {
      console.error('[CustomizationsPage] Failed to fetch customizations', {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error('Failed to load customizations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchData])

  // Re-fetch customizations when user switches back to this tab/page.
  // Replicates SWR's revalidateOnFocus / TanStack Query's refetchOnWindowFocus.
  useRefetchOnFocus(fetchData)

  const saveSettings = useCallback(async (data?: CustomizationSettings) => {
    const toSave = data || settingsRef.current
    setSaving(true)
    try {
      const res = await fetch('/api/customizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: toSave }),
      })
      if (res.ok) {
        toast.success('Customizations saved')
      } else {
        const errData = await res.json().catch(() => ({}))
        console.error('[CustomizationsPage] API returned non-OK', {
          status: res.status,
          body: errData,
        })
        toast.error(errData.error || 'Failed to save customizations')
        // Re-fetch server state so the UI reflects what was actually persisted
        try {
          const freshRes = await fetch('/api/customizations')
          if (freshRes.ok) {
            const freshData = await freshRes.json()
            if (freshData.settings) {
              const reverted = { ...defaultSettings, ...freshData.settings }
              setSettings(reverted)
              settingsRef.current = reverted
            }
          }
        } catch (rollbackError) {
          console.error('[CustomizationsPage] Rollback re-fetch failed', {
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          })
        }
      }
    } catch (error) {
      console.error('[CustomizationsPage] Network error', {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error('Failed to save customizations')
    } finally {
      setSaving(false)
    }
  }, [])

  const updateAndSave = useCallback(
    (patch: Partial<CustomizationSettings>) => {
      const updated = { ...settingsRef.current, ...patch }
      setSettings(updated)
      settingsRef.current = updated
      void saveSettings(updated)
    },
    [saveSettings],
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md border p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="space-y-2 mt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Customizations</h2>
        <p className="text-sm text-muted-foreground">
          Configure the chatbot tone and fallback message.
        </p>
      </div>

      {/* Section 1: Fallback Message */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/30">
          <div className="flex size-8 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <MessageSquareOff className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Fallback Message</h3>
            <p className="text-xs text-muted-foreground">
              Customize the message shown when the chatbot can&apos;t find relevant information to
              answer a question.
            </p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <Textarea
            rows={4}
            value={settings.fallback_message}
            onChange={(e) => {
              const updated = { ...settingsRef.current, fallback_message: e.target.value }
              setSettings(updated)
              settingsRef.current = updated
            }}
            onBlur={() => {
              // Only auto-save if not already saving to prevent double-save
              // when the user clicks the Save button (which steals focus, triggering onBlur).
              if (!saving) void saveSettings()
            }}
            className="text-sm"
            placeholder="Enter a fallback message..."
          />
          <p className="text-xs text-muted-foreground">
            This message will be displayed when the AI cannot find a relevant answer from your
            knowledge base.
          </p>
        </div>
      </div>

      {/* Section 2: Chat Modes */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/30">
          <div className="flex size-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <MessageCircle className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Chat Modes</h3>
            <p className="text-xs text-muted-foreground">
              Select which mode you want your chatbot to be in.
            </p>
          </div>
        </div>
        <div className="p-4">
          <RadioGroup
            value={settings.chat_mode}
            onValueChange={(v) => updateAndSave({ chat_mode: v as 'human' | 'ai' })}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="human" id="chat-mode-human" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="chat-mode-human" className="text-sm font-medium cursor-pointer">
                  Always Starts New Conversation with Human
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every new conversation starts in Human mode. AI won&apos;t reply to it.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="ai" id="chat-mode-ai" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="chat-mode-ai" className="text-sm font-medium cursor-pointer">
                  Always Starts New Conversation with AI
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every new conversation starts in AI mode.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Save Button */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t py-3 px-1 flex justify-end">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => void saveSettings()}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Customizations'}
        </Button>
      </div>
    </div>
  )
}
