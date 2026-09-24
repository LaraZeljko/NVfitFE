import { useEffect, useState } from 'react'
import { signImageUrl } from '../lib/api'
import { plural } from '../lib/format'
import type { StreakInfo } from '../lib/streak'
import type { LoveMessage, StreakImage } from '../types'

type Props = {
  streak: StreakInfo
  /** Only set when a partner has uploaded pictures for you. */
  image: StreakImage | null
  message: LoveMessage | null
  displayName: string | null
}

function greeting(name: string | null, streak: StreakInfo) {
  const hour = new Date().getHours()
  const part = hour < 11 ? 'Morning' : hour < 18 ? 'Hey' : 'Evening'
  const who = name ? `${part}, ${name}` : part
  if (streak.todayIsRest) return `${who} — rest day`
  if (streak.todayDone) return `${who} — done for today`
  return who
}

/** Your training streak. Everyone has one; the picture and message only appear
 *  once a partner has put them there. */
export default function StreakCard({ streak, image, message, displayName }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setUrl(null)
    if (!image) return
    signImageUrl(image.storage_path)
      .then(signed => {
        if (alive) setUrl(signed)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [image])

  return (
    <section className={`streak streak--${streak.state}${image ? '' : ' streak--plain'}`}>
      {image && (
        <div className="streak__picture">
          {url ? <img src={url} alt={image.caption ?? ''} /> : <span className="streak__placeholder" aria-hidden="true" />}
        </div>
      )}
      <div className="streak__body">
        <p className="streak__greeting">{greeting(displayName, streak)}</p>
        <p className="streak__count">
          <strong>{streak.current}</strong> {plural(streak.current, 'day')} in a row
          {streak.longest > streak.current && <span className="muted"> · best {streak.longest}</span>}
        </p>
        {image?.caption && <p className="streak__caption">{image.caption}</p>}
        {message && <p className="streak__message">{message.body}</p>}
      </div>
    </section>
  )
}
