import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { formatNumber } from '../lib/format'

export type ChartPoint = {
  key: string
  /** Week index, so gaps between workouts show up as wider spacing. */
  x: number
  value: number
  /** Tooltip text */
  label: string
  /** Short text on the axis */
  axisLabel: string
}

type Props = {
  points: ChartPoint[]
  formatValue: (value: number) => string
  ariaLabel: string
}

const HEIGHT = 220
const PAD = { top: 32, right: 16, bottom: 30, left: 48 }

function niceStep(raw: number) {
  const power = Math.pow(10, Math.floor(Math.log10(raw)))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * power
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const spread = Math.abs(min) * 0.1 || 1
    min = Math.max(0, min - spread)
    max += spread
  }
  const step = niceStep((max - min) / (count - 1))
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return ticks
}

export default function LineChart({ points, formatValue, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [active, setActive] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setWidth(Math.round(el.clientWidth))
    const observer = new ResizeObserver(entries => setWidth(Math.round(entries[0].contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const plotWidth = Math.max(width - PAD.left - PAD.right, 1)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const values = points.map(p => p.value)
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const xMin = points[0].x
  const xMax = points[points.length - 1].x

  const sx = (x: number) => PAD.left + (xMax === xMin ? plotWidth / 2 : ((x - xMin) / (xMax - xMin)) * plotWidth)
  const sy = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotHeight

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ')
  const lastIndex = points.length - 1
  const lastPoint = points[lastIndex]
  const activePoint = active === null ? null : points[active]

  function handlePointer(e: PointerEvent<SVGSVGElement>) {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    let nearest = 0
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[nearest].x) - x)) nearest = i
    })
    setActive(nearest)
  }

  function handleKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    setActive(current => Math.min(lastIndex, Math.max(0, (current ?? lastIndex + (step > 0 ? -1 : 1)) + step)))
  }

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        className="chart__svg"
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        onPointerLeave={e => {
          if (e.pointerType === 'mouse') setActive(null)
        }}
        onKeyDown={handleKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={sy(tick)} y2={sy(tick)} />
            <text className="chart__tick" x={PAD.left - 8} y={sy(tick)} textAnchor="end" dominantBaseline="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        <text className="chart__tick" x={sx(points[0].x)} y={HEIGHT - 8} textAnchor="start">
          {points[0].axisLabel}
        </text>
        <text className="chart__tick" x={sx(lastPoint.x)} y={HEIGHT - 8} textAnchor="end">
          {lastPoint.axisLabel}
        </text>

        {activePoint && (
          <line className="chart__crosshair" x1={sx(activePoint.x)} x2={sx(activePoint.x)} y1={PAD.top} y2={PAD.top + plotHeight} />
        )}

        <path className="chart__line" d={path} />

        {points.map((p, i) => (
          <circle key={p.key} className="chart__dot" cx={sx(p.x)} cy={sy(p.value)} r={i === active ? 6 : 4} />
        ))}

        {active === null && (
          <text
            className="chart__label"
            x={sx(lastPoint.x)}
            y={Math.max(14, sy(lastPoint.value) - 14)}
            textAnchor="end"
          >
            {formatValue(lastPoint.value)}
          </text>
        )}
      </svg>

      {activePoint && (
        <div className="chart__tooltip" style={{ left: Math.min(Math.max(sx(activePoint.x), 64), width - 64) }}>
          <strong>{formatValue(activePoint.value)}</strong>
          <span>{activePoint.label}</span>
        </div>
      )}
    </div>
  )
}
