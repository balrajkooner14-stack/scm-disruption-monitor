import { COLOR } from "@/lib/brand"

// The onboarding progress bar is the Foreglow sun rising along the horizon
// (spec 6.0). The current stop is a half sun sitting on the line; it slides
// between stops (reduced motion turns the transition off globally).

const LINE_Y = 26

interface Stop {
  x: number
  label?: string
}

interface HorizonProgressProps {
  width?: number
  height?: number
  lineStart: number
  lineEnd: number
  stops: Stop[]
  /** Index of the current stop (labels mode) — completed stops sit before it. */
  currentIndex?: number
  /** Explicit sun position, for the checklist's fractional variant. */
  sunX?: number
  ariaLabel: string
  className?: string
}

export default function HorizonProgress({
  width = 560,
  height = 44,
  lineStart,
  lineEnd,
  stops,
  currentIndex = 0,
  sunX,
  ariaLabel,
  className,
}: HorizonProgressProps) {
  const sun = sunX ?? stops[currentIndex]?.x ?? lineStart
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label={ariaLabel}
      className={className}
      // End-stop labels are centred on x=20 / x=540 and run past the edges.
      overflow="visible"
    >
      <path d={`M${lineStart} ${LINE_Y} H${lineEnd}`} stroke={COLOR.line} strokeWidth="2" />
      <path
        d={`M${lineStart} ${LINE_Y} H${lineEnd}`}
        stroke={COLOR.ink}
        strokeWidth="2"
        strokeDasharray={`${Math.max(0, sun - lineStart)} ${width}`}
        style={{ transition: "stroke-dasharray 400ms ease-out" }}
      />

      {stops.map((stop, i) =>
        i === currentIndex && sunX === undefined ? null : i < currentIndex ? (
          <circle key={i} cx={stop.x} cy={LINE_Y} r="4" fill={COLOR.ink} />
        ) : (
          <circle key={i} cx={stop.x} cy={LINE_Y} r="3" fill={COLOR.lineStrong} />
        ),
      )}

      <g style={{ transform: `translateX(${sun}px)`, transition: "transform 400ms ease-out" }}>
        <path d={`M-14 ${LINE_Y} A14 14 0 0 1 14 ${LINE_Y}`} stroke={COLOR.dawn} strokeWidth="1.5" />
        <path d={`M-8 ${LINE_Y} A8 8 0 0 1 8 ${LINE_Y} Z`} fill={COLOR.ember} />
      </g>

      {stops.map((stop, i) =>
        stop.label ? (
          <text
            key={`label-${i}`}
            x={stop.x}
            y={42}
            textAnchor="middle"
            fontFamily="var(--font-public-sans), sans-serif"
            fontSize="11"
            fontWeight={i === currentIndex ? 600 : 400}
            fill={i === currentIndex ? COLOR.ink : i < currentIndex ? COLOR.ink2 : COLOR.ink3}
          >
            {stop.label}
          </text>
        ) : null,
      )}
    </svg>
  )
}
