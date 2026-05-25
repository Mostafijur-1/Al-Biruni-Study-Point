# Deploy ABSP to Vercel (production)

## Prerequisites

- GitHub repository with this project
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (free tier works)
- [Vercel](https://vercel.com) account linked to GitHub

## 1. MongoDB Atlas

1. Create a cluster and database user.
2. Network Access → allow access (for Vercel serverless, use `0.0.0.0/0` or Vercel's IP ranges).
3. Copy connection string → set as `MONGODB_URI` (database name `absp` is set in code).

## 2. Push to GitHub

```bash
git add .
git commit -m "Prepare ABSP for production"
git push origin main
```

## 3. Import project in Vercel

1. **Add New Project** → import your GitHub repo.
2. Framework: **Next.js** (auto-detected).
3. Build command: `npm run build` (default).
4. Install command: `npm install` (default).
5. Root directory: `.` (repo root).

## 4. Environment variables

In Vercel → **Settings** → **Environment Variables**, add (for **Production**, **Preview**, and **Development**):

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | Yes | Atlas connection string |
| `JWT_ACCESS_SECRET` | Yes | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Yes | Min 32 chars, different random |
| `JWT_ACCESS_EXPIRES` | No | Default `15m` |
| `JWT_REFRESH_EXPIRES` | No | Default `7d` |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://your-project.vercel.app` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | No | `bn` |
| `CLOUDINARY_*` | No | Only if using CQ uploads |

Generate secrets (PowerShell example):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

## 5. Deploy

Click **Deploy**. Vercel runs `npm run build` on each push to `main`.

## 6. After deploy

- Open `https://<your-domain>/bn` — Bangla home.
- Test register/login (needs working `MONGODB_URI`).
- Optional: add custom domain in Vercel → **Domains**.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on env | Ensure JWT secrets exist in Vercel env |
| 500 on login | Check Atlas IP allowlist and `MONGODB_URI` |
| Cookies not set | Set `NEXT_PUBLIC_APP_URL` to exact production URL (https) |

## Local production check

```bash
npm run build
npm run start
```
