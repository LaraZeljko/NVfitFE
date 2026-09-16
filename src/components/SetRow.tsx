import { useState } from 'react'
import { formatInputNumber, parseReps, parseWeight } from '../lib/format'
import type { ExerciseSet, SetValues } from '../types'
import { Close } from './Icons'

type Props = {
  set: ExerciseSet
  /** The same set last time, shown as a grey placeholder. */
  hint?: ExerciseSet
  onSave: (values: SetValues) => void
  onDelete: () => void
}

export default function SetRow({ set, hint, onSave, onDelete }: Props) {
  const [weight, setWeight] = useState(() => formatInputNumber(set.weight_kg))
  const [reps, setReps] = useState(() => (set.reps === null ? '' : String(set.reps)))
  const [invalid, setInvalid] = useState(false)

  function commit() {
    const weightKg = parseWeight(weight)
    const repsValue = parseReps(reps)
    if (weightKg === undefined || repsValue === undefined) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (weightKg === set.weight_kg && repsValue === set.reps) return
    onSave({ weight_kg: weightKg, reps: repsValue })
  }

  const n = set.set_number

  return (
    <div className={`set-row${invalid ? ' is-invalid' : ''}`}>
      <span className="set-row__num">{n}</span>
      <input
        className="field field--num"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`Set ${n}, weight in kg`}
        aria-invalid={invalid || undefined}
        placeholder={hint?.weight_kg != null ? formatInputNumber(hint.weight_kg) : 'kg'}
        value={weight}
        onChange={e => setWeight(e.target.value)}
        onBlur={commit}
      />
      <input
        className="field field--num"
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={`Set ${n}, reps`}
        aria-invalid={invalid || undefined}
        placeholder={hint?.reps != null ? String(hint.reps) : 'reps'}
        value={reps}
        onChange={e => setReps(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <button type="button" className="icon-btn icon-btn--quiet" onClick={onDelete} aria-label={`Delete set ${n}`}>
        <Close />
      </button>
    </div>
  )
}
