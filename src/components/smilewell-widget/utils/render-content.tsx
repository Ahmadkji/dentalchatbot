import type { ReactNode } from 'react'

export function renderWidgetContent(content: string): ReactNode[] {
  const parts = content.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    return part.split('\n').map((line, j) => (
      <span key={`${i}-${j}`}>{j > 0 && <br />}{line}</span>
    ))
  })
}
