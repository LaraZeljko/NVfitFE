const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DAY_MS = 24 * 60 * 60 * 1000

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Dates are kept as 'YYYY-MM-DD' in local time, with no UTC shift.
export function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISODate(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function mondayOf(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

export function currentWeekStart() {
  return toISODate(mondayOf(new Date()))
}

export function addWeeks(weekStart: string, count: number) {
  const date = parseISODate(weekStart)
  date.setDate(date.getDate() + count * 7)
  return toISODate(date)
}

export function weeksBetween(from: string, to: string) {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / (7 * DAY_MS))
}

export function isValidWeekStart(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseISODate(value)
  return toISODate(date) === value && date.getDay() === 1
}

export function todayISO() {
  return toISODate(new Date())
}

export function addDays(value: string, count: number) {
  const date = parseISODate(value)
  date.setDate(date.getDate() + count)
  return toISODate(date)
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS)
}

/** 1 = Monday ... 7 = Sunday */
export function todayDayOfWeek() {
  return ((new Date().getDay() + 6) % 7) + 1
}

export function formatShortDate(value: string) {
  const date = parseISODate(value)
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

export function formatWeekRange(weekStart: string) {
  const start = parseISODate(weekStart)
  const end = parseISODate(weekStart)
  end.setDate(end.getDate() + 6)
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

export function relativeWeekLabel(weekStart: string) {
  const diff = weeksBetween(weekStart, currentWeekStart())
  if (diff === 0) return 'This week'
  if (diff === 1) return 'Last week'
  return null
}
