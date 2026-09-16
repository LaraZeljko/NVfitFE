import { Link } from 'react-router-dom'
import { DAY_NAMES, DAY_SHORT, todayDayOfWeek } from '../lib/weeks'

type Props = {
  active: number
  /** null = current week (no ?week in the URL) */
  week: string | null
}

export default function DayStrip({ active, week }: Props) {
  const today = todayDayOfWeek()
  const query = week ? `?week=${week}` : ''

  return (
    <nav className="day-strip" aria-label="Days of the week">
      {DAY_SHORT.map((label, index) => {
        const dow = index + 1
        const classes = ['day-strip__item', dow === active && 'is-active', dow === today && 'is-today'].filter(Boolean).join(' ')
        return (
          <Link
            key={dow}
            to={`/day/${dow}${query}`}
            replace
            className={classes}
            aria-label={DAY_NAMES[index]}
            aria-current={dow === active ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
