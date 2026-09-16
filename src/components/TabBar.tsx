import { NavLink } from 'react-router-dom'
import { Calendar, Chart } from './Icons'

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main navigation">
      <NavLink to="/" end className="tabbar__link">
        <Calendar />
        <span>Week</span>
      </NavLink>
      <NavLink to="/progress" className="tabbar__link">
        <Chart />
        <span>Progress</span>
      </NavLink>
    </nav>
  )
}
