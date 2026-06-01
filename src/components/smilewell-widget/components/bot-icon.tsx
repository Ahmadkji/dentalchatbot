export function BotIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="34" r="22" fill="white" />
      <rect x="30" y="6" width="4" height="10" rx="2" fill="white" />
      <circle cx="32" cy="5" r="3.5" fill="#FCD34D" />
      <circle cx="24" cy="30" r="3" fill="#1E293B" />
      <circle cx="40" cy="30" r="3" fill="#1E293B" />
      <path d="M24 38Q32 46 40 38" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
