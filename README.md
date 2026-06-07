# Live
https://absp.vercel.app/bn

# ABSP — Al-Biruni Study Point

Bangla-first coaching center website and LMS for **SSC** (grades 9–10) and **HSC** (grades 11–12) science students.

## Brand

- Logo: `public/absp-logo.png` (red, white, yellow)
- Colors: red `#D00000`, yellow `#FFD700`, white backgrounds

## Stack

- Next.js 16 (App Router) + TypeScript
- MongoDB + Mongoose
- JWT auth (phone + password)
- Bangla (`/bn`, default) and English (`/en`)

## Local development

1. Copy `.env.example` to `.env.local` and fill in values.
2. Run:

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000/bn](http://localhost:3000/bn).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build (same as Vercel) |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |

## Deploy to Vercel (GitHub → production)

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add environment variables from `.env.example` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).
4. Deploy — every push to `main` rebuilds automatically.

**Required env vars on Vercel:** `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NEXT_PUBLIC_APP_URL`

## Docs

- [docs/PRD.md](docs/PRD.md) — product requirements
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — technical architecture
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — step-by-step Vercel + MongoDB setup
