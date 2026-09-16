type Props = {
  values: number[]
  width?: number
  height?: number
}

/** Small trend in the list: muted line, the latest week highlighted in the data colour. */
export default function Sparkline({ values, width = 72, height = 28 }: Props) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = 5
  const x = (i: number) => padding + (i / (values.length - 1)) * (width - padding * 2)
  const y = (v: number) => (max === min ? height / 2 : padding + (1 - (v - min) / (max - min)) * (height - padding * 2))
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values.length - 1

  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path d={path} className="sparkline__line" />
      <circle cx={x(last)} cy={y(values[last])} r={4} className="sparkline__dot" />
    </svg>
  )
}
