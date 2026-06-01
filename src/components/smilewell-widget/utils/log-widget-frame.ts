export function logWidgetFrame(
  level: 'info' | 'warn' | 'error',
  message: string,
  details: Record<string, unknown>,
) {
  if (level === 'error') {
    console.error(`[clinic-widget-frame] ${message}`, details)
    return
  }

  if (level === 'warn') {
    console.warn(`[clinic-widget-frame] ${message}`, details)
    return
  }

  console.info(`[clinic-widget-frame] ${message}`, details)
}

export function logWidgetFrameError(message: string, error: unknown, details: Record<string, unknown>) {
  const payload: Record<string, unknown> = { ...details }

  if (error instanceof Error) {
    payload.errorName = error.name
    payload.errorMessage = error.message
    if (error.stack) payload.stack = error.stack
  } else if (error !== undefined && error !== null) {
    payload.error = error
  }

  logWidgetFrame('error', message, payload)
}
