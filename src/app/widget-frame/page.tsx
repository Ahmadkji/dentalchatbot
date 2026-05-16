import { Suspense } from 'react'
import WidgetFramePage from '@/components/widget-frame-page'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clinicId?: string; clinicSlug?: string }>
}) {
  const params = await searchParams
  return (
    <Suspense>
      <WidgetFramePage
        clinicId={params.clinicId || null}
        clinicSlug={params.clinicSlug || null}
      />
    </Suspense>
  )
}
