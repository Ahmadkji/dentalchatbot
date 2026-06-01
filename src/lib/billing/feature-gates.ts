import 'server-only'

export type ClinicBillingPlanState =
  | 'free'
  | 'pending'
  | 'trial'
  | 'active'
  | 'canceled'
  | 'expired'

export type ClinicBillingFeatures = {
  canUseWidget: boolean
  canUseAiChat: boolean
  canCaptureLeads: boolean
  canCreateAppointmentRequests: boolean
  canUseAfterHoursCapture: boolean
  canAccessAdvancedInsights: boolean
}

export type ClinicBillingFeatureInput = {
  state: ClinicBillingPlanState
  isActive: boolean
}

export function getClinicBillingFeatures(
  input: ClinicBillingFeatureInput
): ClinicBillingFeatures {
  const premiumEnabled =
    input.isActive && (input.state === 'trial' || input.state === 'active' || input.state === 'canceled')

  return {
    canUseWidget: true,
    canUseAiChat: true,
    // Lead capture is a core product feature available on all plans.
    // Free clinics need to capture patient contact info to see product value,
    // which drives upgrades for insights, appointments, and after-hours features.
    canCaptureLeads: true,
    canCreateAppointmentRequests: premiumEnabled,
    canUseAfterHoursCapture: premiumEnabled,
    canAccessAdvancedInsights: premiumEnabled,
  }
}
