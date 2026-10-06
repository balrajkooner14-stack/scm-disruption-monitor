import { BRAND } from "@/lib/brand"

interface LogoProps {
  size?: number          // mark height in px, default 30
  showWordmark?: boolean // default true
  className?: string
}

// First light breaking the horizon: half sun, one arc of glow, one horizon
// line. Never recolour the sun, add effects, or set the wordmark in sans.
export default function Logo({ size = 30, showWordmark = true, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M6 30 A18 18 0 0 1 42 30" stroke="#E0A077" strokeWidth="2" />
        <path d="M12 30 A12 12 0 0 1 36 30 Z" fill="#B04A22" />
        <path d="M3 30 H45" stroke="#1B2330" strokeWidth="2.5" />
      </svg>
      {showWordmark && (
        <span className="font-serif text-[25px] leading-none text-ink">{BRAND.name}</span>
      )}
    </span>
  )
}
