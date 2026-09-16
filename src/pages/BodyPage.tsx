import { useEffect, useMemo, useState } from 'react'
import { Logo, Trash } from '../components/Icons'
import LineChart from '../components/LineChart'
import { ErrorState, Loading, OfflineBanner, SaveIndicator } from '../components/Status'
import TabBar from '../components/TabBar'
import { useSaveQueue } from '../hooks/useSaveQueue'
import { deleteBodyEntry, fetchBodyEntries, saveBodyEntry } from '../lib/api'
import { errorMessage, formatInputNumber, formatNumber, parseWeight, parseWholeNumber } from '../lib/format'
import { addDays, daysBetween, formatShortDate, todayISO } from '../lib/weeks'
import type { BodyEntry, BodyValues } from '../types'

const RANGE_DAYS = 90

type Draft = { weight: string; calories: string; protein: string; note: string }

const emptyDraft: Draft = { weight: '', calories: '', protein: '', note: '' }

function toDraft(entry: BodyEntry | undefined): Draft {
  if (!entry) return emptyDraft
  return {
    weight: formatInputNumber(entry.weight_kg),
    calories: entry.calories === null ? '' : String(entry.calories),
    protein: entry.protein_g === null ? '' : String(entry.protein_g),
    note: entry.note ?? '',
  }
}

export default function BodyPage() {
  const today = todayISO()
  const [entries, setEntries] = useState<BodyEntry[] | null>(null)
  const [date, setDate] = useState(today)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const save = useSaveQueue()

  useEffect(() => {
    let alive = true
    setError(null)
    fetchBodyEntries(addDays(today, -(RANGE_DAYS - 1)), today)
      .then(rows => {
        if (!alive) return
        setEntries(rows)
        setDraft(toDraft(rows.find(r => r.entry_date === date)))
      })
      .catch(err => {
        if (alive) setError(errorMessage(err))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, reloadKey])

  function changeDate(next: string) {
    setDate(next)
    setInvalid(false)
    setDraft(toDraft(entries?.find(r => r.entry_date === next)))
  }

  function commit(patch: Partial<Draft>) {
    const merged = { ...draft, ...patch }
    setDraft(merged)

    const weight = parseWeight(merged.weight)
    const calories = parseWholeNumber(merged.calories, 20000)
    const protein = parseWholeNumber(merged.protein, 1000)
    if (weight === undefined || calories === undefined || protein === undefined) {
      setInvalid(true)
      return
    }
    setInvalid(false)

    const values: BodyValues = {
      weight_kg: weight,
      calories,
      protein_g: protein,
      note: merged.note.trim() === '' ? null : merged.note.trim(),
    }
    const existing = entries?.find(r => r.entry_date === date)
    const unchanged =
      existing &&
      existing.weight_kg === values.weight_kg &&
      existing.calories === values.calories &&
      existing.protein_g === values.protein_g &&
      (existing.note ?? null) === values.note
    if (unchanged) return

    const entryDate = date
    void save.run(async () => {
      const row = await saveBodyEntry(entryDate, values)
      setEntries(list => [...(list ?? []).filter(r => r.entry_date !== entryDate), row].sort((a, b) => a.entry_date.localeCompare(b.entry_date)))
    })
  }

  function handleDelete(entry: BodyEntry) {
    if (!window.confirm(`Delete the entry for ${formatShortDate(entry.entry_date)}?`)) return
    setEntries(list => (list ?? []).filter(r => r.entry_date !== entry.entry_date))
    if (entry.entry_date === date) setDraft(emptyDraft)
    void save.run(() => deleteBodyEntry(entry.entry_date))
  }

  const weighed = useMemo(() => (entries ?? []).filter(r => r.weight_kg !== null), [entries])
  const first = weighed[0]
  const points = first
    ? weighed.map(r => ({
        key: r.entry_date,
        x: daysBetween(first.entry_date, r.entry_date),
        value: r.weight_kg as number,
        label: formatShortDate(r.entry_date),
        axisLabel: formatShortDate(r.entry_date),
      }))
    : []

  const latest = weighed.at(-1)
  const previous = weighed.at(-2)
  const history = [...(entries ?? [])].reverse()

  return (
    <div className="page page--tabs">
      <header className="top">
        <div className="brand">
          <Logo size={32} />
          <span className="brand-word">
            NV<b>fit</b>
          </span>
        </div>
        <SaveIndicator status={save.status} />
      </header>

      <OfflineBanner />

      <p className="eyebrow">Last {RANGE_DAYS} days</p>
      <h1 className="h1">Body</h1>

      {error && <ErrorState message={error} onRetry={() => setReloadKey(k => k + 1)} />}
      {!entries && !error && <Loading />}

      {entries && (
        <>
          <section className="card">
            <h2 className="card__title">Log a day</h2>
            <p className="card__sub">Everything here is optional — fill in only what you care about.</p>

            <label className="label settings-field">
              Date
              <input className="field" type="date" max={today} value={date} onChange={e => changeDate(e.target.value || today)} />
            </label>

            <div className="body-grid">
              <label className="label">
                Weight (kg)
                <input
                  className="field field--num"
                  inputMode="decimal"
                  value={draft.weight}
                  onChange={e => setDraft({ ...draft, weight: e.target.value })}
                  onBlur={e => commit({ weight: e.target.value })}
                />
              </label>
              <label className="label">
                Calories
                <input
                  className="field field--num"
                  inputMode="numeric"
                  value={draft.calories}
                  onChange={e => setDraft({ ...draft, calories: e.target.value })}
                  onBlur={e => commit({ calories: e.target.value })}
                />
              </label>
              <label className="label">
                Protein (g)
                <input
                  className="field field--num"
                  inputMode="numeric"
                  value={draft.protein}
                  onChange={e => setDraft({ ...draft, protein: e.target.value })}
                  onBlur={e => commit({ protein: e.target.value })}
                />
              </label>
            </div>

            <label className="label">
              Note
              <input
                className="field"
                maxLength={500}
                placeholder="How the day felt"
                value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })}
                onBlur={e => commit({ note: e.target.value })}
              />
            </label>

            {invalid && (
              <p className="form-message form-message--error" role="alert">
                Check the numbers — weight up to 400 kg, calories up to 20000, protein up to 1000 g.
              </p>
            )}
          </section>

          {latest && (
            <div className="stats">
              <div className="stat">
                <span className="stat__label">Latest weight</span>
                <span className="stat__value">{formatNumber(latest.weight_kg as number)} kg</span>
                <span className="stat__meta">
                  {previous
                    ? `${((latest.weight_kg as number) - (previous.weight_kg as number)).toFixed(1)} kg vs ${formatShortDate(previous.entry_date)}`
                    : formatShortDate(latest.entry_date)}
                </span>
              </div>
            </div>
          )}

          <section className="card">
            <h2 className="card__title">Weight</h2>
            <p className="card__sub">Every day you logged a weight</p>
            {points.length >= 2 ? (
              <LineChart
                points={points}
                formatValue={value => `${formatNumber(value)} kg`}
                ariaLabel={`Body weight across ${points.length} days. All values are in the table below.`}
              />
            ) : (
              <p className="muted">The chart appears once you have logged your weight on at least two days.</p>
            )}
          </section>

          <section className="card">
            <h2 className="card__title">Entries</h2>
            {history.length === 0 ? (
              <p className="muted">Nothing logged yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="history">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col" className="num">
                        kg
                      </th>
                      <th scope="col" className="num">
                        kcal
                      </th>
                      <th scope="col" className="num">
                        Protein
                      </th>
                      <th scope="col" aria-label="Delete" />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(entry => (
                      <tr key={entry.entry_date}>
                        <th scope="row">
                          <button type="button" className="link-inline" onClick={() => changeDate(entry.entry_date)}>
                            {formatShortDate(entry.entry_date)}
                          </button>
                        </th>
                        <td className="num">{entry.weight_kg === null ? '–' : formatNumber(entry.weight_kg)}</td>
                        <td className="num">{entry.calories === null ? '–' : formatNumber(entry.calories)}</td>
                        <td className="num">{entry.protein_g === null ? '–' : `${formatNumber(entry.protein_g)} g`}</td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn icon-btn--quiet"
                            onClick={() => handleDelete(entry)}
                            aria-label={`Delete the entry for ${formatShortDate(entry.entry_date)}`}
                          >
                            <Trash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <TabBar />
    </div>
  )
}
