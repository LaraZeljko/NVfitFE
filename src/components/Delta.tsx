import { ArrowDown, ArrowUp } from './Icons'

type Props = {
  value: number | null
  format: (value: number) => string
}

/** Change against last time. Direction is carried by the arrow and sign, not colour alone. */
export default function Delta({ value, format }: Props) {
  if (value === null) return null

  if (Math.abs(value) < 0.005) {
    return <span className="delta delta--flat">= same</span>
  }

  const up = value > 0
  return (
    <span className={`delta ${up ? 'delta--up' : 'delta--down'}`}>
      {up ? <ArrowUp /> : <ArrowDown />}
      {up ? '+' : '−'}
      {format(Math.abs(value))}
    </span>
  )
}
