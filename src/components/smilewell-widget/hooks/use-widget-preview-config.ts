import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { buildLeadGatePayload } from '@/lib/chat/lead-gate'
import { buildLeadGatePrompt, parseLeadRequiredFieldsSettingValue } from '@/lib/leads/lead-gate-settings'
import type { WidgetPublicConfig } from '@/components/smilewell-widget/types'
import { logWidgetFrame, logWidgetFrameError } from '@/components/smilewell-widget/utils/log-widget-frame'

interface PreviewConfigInput {
  preview: boolean
  clinicId: string | null
  clinicSlug: string | null
  setWidgetConfig: Dispatch<SetStateAction<WidgetPublicConfig>>
}

export function useWidgetPreviewConfig(input: PreviewConfigInput) {
  const { preview, clinicId, clinicSlug, setWidgetConfig } = input

  useEffect(() => {
    if (!preview || !clinicId) return

    let cancelled = false

    async function loadPreviewConfig() {
      try {
        logWidgetFrame('info', 'Loading preview widget config.', {
          clinicId,
          clinicSlug,
        })
        const [settingsRes, promptsRes, clinicRes, billingRes, leadSettingsRes] = await Promise.all([
          fetch('/api/widget-settings', { cache: 'no-store' }),
          fetch('/api/widget-settings/quick-prompts', { cache: 'no-store' }),
          fetch('/api/clinic', { cache: 'no-store' }),
          fetch('/api/billing/freemius/status', { cache: 'no-store' }),
          fetch('/api/lead-settings', { cache: 'no-store' }),
        ])

        const requiredFailures = [
          !settingsRes.ok
            ? {
                endpoint: '/api/widget-settings',
                status: settingsRes.status,
                statusText: settingsRes.statusText,
              }
            : null,
          !promptsRes.ok
            ? {
                endpoint: '/api/widget-settings/quick-prompts',
                status: promptsRes.status,
                statusText: promptsRes.statusText,
              }
            : null,
        ].filter(Boolean)

        if (requiredFailures.length > 0) {
          logWidgetFrameError('Preview config failed to load.', new Error('Preview config request failed'), {
            clinicId,
            clinicSlug,
            failures: requiredFailures,
          })
          return
        }

        const settings = await settingsRes.json()
        const prompts = await promptsRes.json()
        const clinic = clinicRes.ok ? await clinicRes.json() : null
        const billing = billingRes.ok ? await billingRes.json() : null
        void billing
        const leadSettings = leadSettingsRes.ok ? await leadSettingsRes.json() : null
        if (!leadSettingsRes.ok) {
          logWidgetFrame('warn', 'Preview lead settings failed to load. Falling back to defaults.', {
            clinicId,
            clinicSlug,
            status: leadSettingsRes.status,
            statusText: leadSettingsRes.statusText,
          })
        }
        const previewLeadFields = parseLeadRequiredFieldsSettingValue(
          leadSettings?.settings?.required_fields,
        )
        const collectionEnabled = leadSettings?.settings?.collection_enabled
        const previewLeadGateRequired =
          collectionEnabled === undefined ? false : collectionEnabled !== 'false'

        if (cancelled) return

        setWidgetConfig((prev) => ({
          ...prev,
          widgetTitle: settings.botName || prev.widgetTitle,
          welcomeMessage: settings.welcomeMessage || prev.welcomeMessage,
          primaryColor: settings.primaryColor || prev.primaryColor,
          leadGateRequired: previewLeadGateRequired,
          leadGate: buildLeadGatePayload({
            fields: previewLeadFields,
            prompt: buildLeadGatePrompt(previewLeadFields),
          }),
          showWhatsappButton: !!(clinic?.whatsappNumber || clinic?.whatsapp),
          showCallButton: !!(clinic?.primaryPhone || clinic?.phone),
          showLocationButton: !!(clinic?.mapLink || clinic?.google_maps_url),
          whatsappLink: (clinic?.whatsappNumber || clinic?.whatsapp)
            ? `https://wa.me/${(clinic.whatsappNumber || clinic.whatsapp).replace(/^\+/, '')}`
            : null,
          phoneLink: clinic?.primaryPhone || clinic?.phone || null,
          mapsLink: clinic?.mapLink || clinic?.google_maps_url || null,
          quickPrompts:
            Array.isArray(prompts) && prompts.length > 0
              ? prompts
                  .filter((prompt: { isActive?: boolean }) => prompt.isActive !== false)
                  .map((prompt: { label: string; intent?: string | null }) => ({
                    label: prompt.label,
                    intent: prompt.intent ?? null,
                  }))
              : prev.quickPrompts,
        }))
      } catch (error) {
        logWidgetFrameError('Preview config load threw an error.', error, {
          clinicId,
          clinicSlug,
        })
      }
    }

    void loadPreviewConfig()

    return () => {
      cancelled = true
    }
  }, [preview, clinicId, clinicSlug, setWidgetConfig])
}
