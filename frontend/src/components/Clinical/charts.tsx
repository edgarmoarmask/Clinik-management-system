// Plain SVG/CSS charts, single-series, drawn in the theme's primary color so
// they follow light/dark mode without a chart dependency.
import { useState } from "react"

type Datum = { label: string; value: number }

export function LineChart({ data, label }: { data: Datum[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 520
  const H = 200
  const padL = 36
  const padR = 12
  const padT = 14
  const padB = 26
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.1
  const x = (i: number) =>
    padL + (i * (W - padL - padR)) / Math.max(1, data.length - 1)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const path = data
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`)
    .join(" ")
  const area = `${path} L${x(data.length - 1)},${H - padB} L${x(0)},${H - padB} Z`
  const ticks = [0, max / 2, max]
  const step = (W - padL - padR) / Math.max(1, data.length - 1)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full text-primary"
      role="img"
      aria-label={label}
      onMouseMove={(e) => {
        // Snap to the nearest point so the whole column is the hit target.
        const rect = e.currentTarget.getBoundingClientRect()
        const px = ((e.clientX - rect.left) / rect.width) * W
        const i = Math.round((px - padL) / step)
        setHover(Math.min(data.length - 1, Math.max(0, i)))
      }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            className="stroke-border"
          />
          <text
            x={padL - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="10"
            className="fill-muted-foreground"
          >
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#lineFill)" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {hover !== null && (
        <line
          x1={x(hover)}
          x2={x(hover)}
          y1={padT}
          y2={H - padB}
          className="stroke-muted-foreground"
          strokeDasharray="3 3"
        />
      )}
      {data.map((d, i) => (
        <g key={d.label}>
          <circle
            cx={x(i)}
            cy={y(d.value)}
            r={hover === i ? 5 : 4}
            stroke="currentColor"
            strokeWidth="2"
            className="fill-background"
          />
          <text
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            className="fill-muted-foreground"
          >
            {d.label}
          </text>
          {hover === i && (
            <text
              x={x(i)}
              y={y(d.value) - 10}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              className="fill-foreground"
            >
              {d.value}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export function HBars({
  data,
  format = (v) => String(v),
}: {
  data: Datum[]
  format?: (v: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex flex-col gap-3.5">
      {data.map((d) => (
        <div key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{d.label}</span>
            <span className="font-semibold text-muted-foreground">
              {format(d.value)}
            </span>
          </div>
          <div className="h-2 rounded bg-muted">
            <div
              className="h-full rounded bg-primary"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ColumnChart({
  data,
  height = 150,
}: {
  data: Datum[]
  height?: number
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-3">
      {data.map((d) => (
        <div
          key={d.label}
          className="flex flex-1 flex-col items-center gap-1.5"
          title={`${d.label}: ${d.value}`}
        >
          <span className="text-xs font-semibold text-muted-foreground">
            {d.value}
          </span>
          <div
            className="w-full rounded-t bg-primary"
            style={{
              height: Math.max(4, Math.round((d.value / max) * height)),
            }}
          />
          <span className="text-xs text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
