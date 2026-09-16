import { NavLink } from 'react-router-dom'
import { Calendar, Chart, Heart } from './Icons'

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main navigation">
      <NavLink to="/" end className="tabbar__link">
        <Calendar />
        <span>Week</span>
      </NavLink>
      <NavLink to="/body" className="tabbar__link">
        <Heart />
        <span>Body</span>
      </NavLink>
      <NavLink to="/progress" className="tabbar__link">
        <Chart />
        <span>Progress</span>
      </NavLink>
    </nav>
  )
}
