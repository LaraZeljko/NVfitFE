# NVfit – frontend

A progressive web app (PWA) for tracking workouts: a weekly plan by day, exercises with weight and reps per set, and a comparison against previous weeks.

**Stack:** React, TypeScript, Vite, React Router, Supabase JS client, vite-plugin-pwa (Workbox).

The backend (database, access rules) lives in the **NVfitBE** repository.

## Running locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the **Project URL** and **Publishable key** from the Supabase dashboard.
3. `npm run dev`, then open http://localhost:5173

On a phone connected to the same Wi-Fi, open the address Vite prints as **Network**. Installing it as an app requires the deployed (https) version.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | type check and production build into `dist/` |
| `npm run preview` | local preview of the production build |
| `npm run icons` | regenerates the icons from `public/logo.svg` |

## Structure

```
src/
  pages/        WeekPage, DayPage (logging), ProgressPage, ExerciseProgressPage
  components/   ExerciseCard, SetRow, WeekSwitcher, DayStrip, LineChart, Sparkline...
  hooks/        useSession, useSaveQueue (serialised writes), useOnline
  lib/          api.ts (all Supabase calls), weeks.ts, metrics.ts, format.ts
```

Notes worth knowing:

- A week is identified by its Monday (`week_start`), so the same plan repeats every week while each week's entries stay separate and comparable.
- Sets are saved when an input loses focus, through a queue, so deleting a set (which renumbers the rest) never overlaps with a write.
- Last week's values are shown as placeholders in the input fields, so you always see what you have to beat.

## Deploying to Netlify (free)

1. Push the code to GitHub.
2. [netlify.com](https://netlify.com) → **Add new project → Import an existing project → GitHub** → pick the repository.
3. Build settings are read from `netlify.toml`.
4. **Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`.
5. **Deploy**. Every following `git push` publishes a new version automatically.

## Installing on Android

1. Open the Netlify address in **Chrome**.
2. Menu (⋮) → **Install app** (or *Add to Home screen*).
3. NVfit appears among the apps and opens full screen.

New versions are picked up automatically the next time the app is opened.
