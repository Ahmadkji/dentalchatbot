'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

const SmileWellWidget = dynamic(() => import('@/components/smilewell-widget'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="animate-pulse text-sm text-gray-400">Loading widget...</div>
    </div>
  ),
})

export default function WidgetFramePage({
  clinicId,
  clinicSlug,
}: {
  clinicId: string | null
  clinicSlug: string | null
}) {
  const searchParams = useSearchParams()
  const embedded = searchParams.get('mode') === 'embedded'
  const preview = searchParams.has('preview')
  const sessionHandoff = searchParams.get('handoff') === '1'

  return (
    <SmileWellWidget
      embedded={embedded}
      clinicId={clinicId}
      clinicSlug={clinicSlug}
      preview={preview}
      sessionHandoff={sessionHandoff}
    />
  )
}
