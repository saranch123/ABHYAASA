# ABHYAASA Frontend

**Tech stack:** Next.js 14 (App Router) · TypeScript · TailwindCSS · shadcn-style components · Recharts · Sonner

---

## Quick Start (Demo Mode — no backend needed)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** — runs 100% in **Demo Mode** by default (no backend required).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |

Create `.env.local` (already provided):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Live Mode (with backend)

1. Start the backend: `uvicorn app.main:app --reload --port 8000` (from `backend/`)
2. Toggle **Demo → Live** in the navbar
3. All API calls go to the real backend; failures silently fall back to demo data

---

## File Tree

```
frontend/
├── app/
│   ├── globals.css          # CSS variables + dark/light theme
│   ├── layout.tsx           # Root layout (Navbar + Toaster)
│   ├── page.tsx             # Landing page
│   ├── practice/page.tsx    # Main training page (full state machine)
│   └── progress/page.tsx    # Progress dashboard (recharts)
├── components/
│   ├── Navbar.tsx           # Live/Demo toggle + theme toggle
│   ├── CameraPanel.tsx      # Webcam with permission fallback
│   └── ui/                  # shadcn-style UI components
├── lib/
│   ├── types.ts             # All TypeScript types (matches backend schema)
│   ├── utils.ts             # cn, formatTime, score colour helpers
│   ├── store.ts             # localStorage (mode, token, sessions)
│   ├── mock.ts              # Deterministic demo mode API
│   └── api.ts               # Live API client (typed fetch)
├── hooks/
│   ├── useMode.ts           # Live/Demo mode hook
│   └── useTimer.ts          # Countdown timer (start/pause/reset)
├── .env.example
├── .env.local               # Points to localhost:8000
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing — track grid + CTA |
| `/practice` | Training session (configure → generate → run → submit → feedback → retry/continue) |
| `/practice?track=INTERVIEW` | Pre-selects track from query param |
| `/progress` | Score trend chart, dimension bars, session history, track breakdown |

---

## Practice State Machine

```
IDLE → GENERATING → GENERATED → RUNNING → SUBMITTING → FEEDBACK
                                                          ↓
                                              Retry (same level) / Continue (next level)
```

- **IDLE**: Select track, level, type on the left panel
- **GENERATING**: Skeleton shown while API (or mock) generates session
- **GENERATED**: Brief, persona, prompt, constraints visible — click **Start Practice**
- **RUNNING**: Countdown timer active; config panel locked; camera optional
- **SUBMITTING**: Loading state after Submit Attempt
- **FEEDBACK**: Score ring, 4-dimension breakdown, feedback bullets, next-attempt instruction

---

## Demo Mode

All session data, scoring, and progress in Demo Mode is computed locally using `lib/mock.ts`:
- Sessions persist to `localStorage` across reloads
- Progress page seeds realistic historical data if no local sessions exist
- Scoring uses filler word detection, structure markers, and word count heuristics

---

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
