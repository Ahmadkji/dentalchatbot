'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  MessageSquareOff,
  MessageCircle,
  UserCheck,
  Database,
  LightbulbOff,
  Settings,
} from 'lucide-react'

interface CustomizationSettings {
  fallback_message: string
  chat_mode: 'human' | 'ai'
  collect_user_details: 'mandatory' | 'optional' | 'none'
  collect_name: boolean
  collect_email: boolean
  collect_phone: boolean
  disable_smart_followup: boolean
  smart_followup_count: number
}

const defaultSettings: CustomizationSettings = {
  fallback_message:
    "I'm sorry, I don't have the information you're looking for. Let me connect you with someone who can help.",
  chat_mode: 'ai',
  collect_user_details: 'optional',
  collect_name: true,
  collect_email: true,
  collect_phone: true,
  disable_smart_followup: false,
  smart_followup_count: 3,
}

export default function CustomizationsPage() {
  const [settings, setSettings] = useState<CustomizationSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/customizations')
        if (res.ok) {
          const data = await res.json()
          if (data.settings) {
            setSettings({ ...defaultSettings, ...data.settings })
            settingsRef.current = { ...defaultSettings, ...data.settings }
          }
        }
      } catch {
        // Use defaults on error
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

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
        toast.error('Failed to save customizations')
      }
    } catch {
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
    [saveSettings]
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
          Configure your chatbot behavior, messaging, and data collection preferences.
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
            onBlur={() => void saveSettings()}
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

      {/* Section 3: Collect User Details */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/30">
          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <UserCheck className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Collect User Details</h3>
            <p className="text-xs text-muted-foreground">
              Choose whether or not you want to collect the user details.
            </p>
          </div>
        </div>
        <div className="p-4">
          <RadioGroup
            value={settings.collect_user_details}
            onValueChange={(v) =>
              updateAndSave({ collect_user_details: v as 'mandatory' | 'optional' | 'none' })
            }
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="mandatory" id="collect-mandatory" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="collect-mandatory" className="text-sm font-medium cursor-pointer">
                  Mandatory
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  User has to enter their details before they can continue the conversation.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="optional" id="collect-optional" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="collect-optional" className="text-sm font-medium cursor-pointer">
                  Optional
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We try to collect user details, but user should still be able to continue chatting
                  by skipping the user details forms.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="none" id="collect-none" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="collect-none" className="text-sm font-medium cursor-pointer">
                  Do Not Collect
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We will not collect any user details.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Section 4: Data Types */}
      {settings.collect_user_details !== 'none' && (
        <div className="rounded-md border">
          <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/30">
            <div className="flex size-8 items-center justify-center rounded-md bg-violet-100 text-violet-700">
              <Database className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Data Types</h3>
              <p className="text-xs text-muted-foreground">
                Choose what information you want to collect from visitors.
              </p>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id="data-name"
                checked={settings.collect_name}
                onCheckedChange={(checked) => updateAndSave({ collect_name: !!checked })}
              />
              <Label htmlFor="data-name" className="text-sm font-medium cursor-pointer flex-1">
                Name
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id="data-email"
                checked={settings.collect_email}
                onCheckedChange={(checked) => updateAndSave({ collect_email: !!checked })}
              />
              <Label htmlFor="data-email" className="text-sm font-medium cursor-pointer flex-1">
                Email Address
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id="data-phone"
                checked={settings.collect_phone}
                onCheckedChange={(checked) => updateAndSave({ collect_phone: !!checked })}
              />
              <Label htmlFor="data-phone" className="text-sm font-medium cursor-pointer flex-1">
                Phone Number
              </Label>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Disable Smart Follow Up Questions */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/30">
          <div className="flex size-8 items-center justify-center rounded-md bg-rose-100 text-rose-700">
            <LightbulbOff className="size-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Disable Smart Follow Up Questions</h3>
            <p className="text-xs text-muted-foreground">
              SiteGPT suggests smart follow up questions to help the user get required information
              faster. Click this toggle to disable it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="disable-followup" className="text-xs font-medium">
              Disable smart follow up questions
            </Label>
            <Switch
              id="disable-followup"
              checked={settings.disable_smart_followup}
              onCheckedChange={(checked) => updateAndSave({ disable_smart_followup: checked })}
            />
          </div>
        </div>
        {!settings.disable_smart_followup && (
          <div className="p-4 space-y-3">
            <Label htmlFor="followup-count" className="text-sm font-medium">
              Number of smart follow up questions to be shown
            </Label>
            <Input
              id="followup-count"
              type="number"
              min={1}
              max={5}
              value={settings.smart_followup_count}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1 && val <= 5) {
                  const updated = { ...settingsRef.current, smart_followup_count: val }
                  setSettings(updated)
                  settingsRef.current = updated
                }
              }}
              onBlur={() => void saveSettings()}
              className="w-20 h-9 text-center text-sm"
            />
            <p className="text-xs text-muted-foreground">Choose a number between 1 and 5.</p>
          </div>
        )}
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
