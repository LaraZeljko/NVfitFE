import { addWeeks, currentWeekStart, formatWeekRange, relativeWeekLabel } from '../lib/weeks'
import { ChevronLeft, ChevronRight } from './Icons'

type Props = {
  week: string
  onChange: (week: string) => void
}

export default function WeekSwitcher({ week, onChange }: Props) {
  const thisWeek = currentWeekStart()
  const relative = relativeWeekLabel(week)

  return (
    <div className="week-switcher">
      <button type="button" className="icon-btn" onClick={() => onChange(addWeeks(week, -1))} aria-label="Previous week">
        <ChevronLeft />
      </button>
      <button
        type="button"
        className="week-switcher__label"
        onClick={() => onChange(thisWeek)}
        disabled={week === thisWeek}
        aria-label={week === thisWeek ? `This week, ${formatWeekRange(week)}` : 'Back to this week'}
      >
        <strong>{relative ?? formatWeekRange(week)}</strong>
        <span>{relative ? formatWeekRange(week) : 'Back to this week'}</span>
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addWeeks(week, 1))}
        disabled={week >= thisWeek}
        aria-label="Next week"
      >
        <ChevronRight />
      </button>
    </div>
  )
}
