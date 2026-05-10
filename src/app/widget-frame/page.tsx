import WidgetFramePage from '@/components/widget-frame-page'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clinicId?: string }>
}) {
  const params = await searchParams
  return <WidgetFramePage clinicId={params.clinicId || null} />
}
