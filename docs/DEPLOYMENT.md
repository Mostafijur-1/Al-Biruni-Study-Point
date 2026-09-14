# Deploy ABSP

## cPanel Git deployment (abspoint.top)

The repository also includes `.cpanel.yml` for the cPanel-managed checkout at
`/home/abspoint/repositories/Al-Biruni-Study-Point`. Its deployment task installs
locked dependencies, runs the `build:cpanel` script in that checkout, and signals
Passenger to restart using the root-level `app.js` startup file. This separate
build script forces the standard production `NODE_ENV` and disables Node.js's
WebAssembly trap handler to reduce virtual-address-space reservations on the
CloudLinux host. It requires Node.js 20.15+ or 22.2+. Do not copy this server-side
application into `public_html` as a static website.

Before using **Deploy HEAD Commit** in cPanel:

1. Confirm the hosting plan offers **Application Manager** or **Setup Node.js App**
   with Node.js 20.15+ or 22.2+. Register the application with the repository path
   above as its application root, `app.js` as its startup file, and the intended
   domain as its deployment domain. The host must supply a `PORT` to Passenger.
2. Set production environment variables in the Node.js application settings.
   At minimum, configure `MONGODB_URI`, `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, and `NEXT_PUBLIC_APP_URL=https://abspoint.top`. Review
   the rollout flags in the Vercel section below before enabling any writes.
3. Commit and push `.cpanel.yml`, `app.js`, and `.gitignore` to GitHub. In cPanel
   Git Version Control, use **Update from Remote**, then **Deploy HEAD Commit**.
   cPanel requires the `.cpanel.yml` file to be checked in at the repository root
   and the **cPanel-managed checkout** to have a clean working tree. Local
   untracked files on a different computer do not affect that checkout.

The deployment task needs `node` and `npm` on the deployment shell's `PATH`.
If the host exposes Node.js only through a versioned path or virtual environment,
adjust the task for that environment before deploying. A successful Git deploy
does not itself register or start the Node.js application.

In cPanel **Web Applications**, run **NPM Install** before choosing the
`build:cpanel` JS script. If that script still fails with out-of-memory, the
account's LVE or address-space limits must be raised by the host, or builds must
move off-server; this script cannot bypass a hard physical-memory limit.

## Vercel deployment (production)

### Prerequisites

- GitHub repository with this project
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (free tier works)
- [Vercel](https://vercel.com) account linked to GitHub

### 1. MongoDB Atlas

1. Create a cluster and database user.
2. Network Access → allow access (for Vercel serverless, use `0.0.0.0/0` or Vercel's IP ranges).
3. Copy connection string → set as `MONGODB_URI` (database name `absp` is set in code).

### 2. Push to GitHub

```bash
git add .
git commit -m "Prepare ABSP for production"
git push origin main
```

### 3. Import project in Vercel

1. **Add New Project** → import your GitHub repo.
2. Framework: **Next.js** (auto-detected).
3. Build command: `npm run build` (default).
4. Install command: `npm install` (default).
5. Root directory: `.` (repo root).

### 4. Environment variables

In Vercel → **Settings** → **Environment Variables**, add (for **Production**, **Preview**, and **Development**):

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | Yes | Atlas connection string |
| `JWT_ACCESS_SECRET` | Yes | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Yes | Min 32 chars, different random |
| `JWT_ACCESS_EXPIRES` | No | Default `365d` |
| `JWT_REFRESH_EXPIRES` | No | Default `3650d` |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://your-project.vercel.app` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | No | `bn` |
| `CLOUDINARY_*` | No | Only if using CQ uploads |
| `ACADEMIC_WRITES_ENABLED` | Yes | Default `false`; enable only with approved rollout evidence |
| `CANONICAL_ACADEMIC_AUTHORITY_ENABLED` | Yes | Canonical teacher/enrollment authority rollout flag |
| `WRITTEN_EXAM_KERNEL_WRITES` | Yes | Default `true`; rollback switch for canonical written attempts |
| `FINANCE_LEDGER_AUTHORITY_ENABLED` | Yes | Default `false` until opening reconciliation is approved |
| `REPORTING_PROJECTIONS_ENABLED` | Yes | Default `false` until reconciliation and p95 gates pass |

Generate secrets (PowerShell example):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### 5. Deploy

Click **Deploy**. Vercel runs `npm run build` on each push to `main`.

Before promotion, run typecheck, lint, full tests, affected replica-set DB suites, and the production build. Migration commands require an explicit environment/database and confirmation token. Preserve the dry-run report before apply. Deployment success alone never authorizes a feature flag.

### 6. After deploy

- Open `https://<your-domain>/bn` — Bangla home.
- Test register/login (needs working `MONGODB_URI`).
- Optional: add custom domain in Vercel → **Domains**.

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on env | Ensure JWT secrets exist in Vercel env |
| 500 on login | Check Atlas IP allowlist and `MONGODB_URI` |
| Cookies not set | Set `NEXT_PUBLIC_APP_URL` to exact production URL (https) |

### Local production check

```bash
npm run build
npm run start
```

### Backup, rollback, and schema contraction

Record a current Atlas snapshot and release commit before migrations. Rehearse restore into an isolated non-production target using `RECOVERY_RUNBOOK.md`. Legacy schema contraction additionally requires `LEGACY_CONTRACTION_RUNBOOK.md`; deployment access alone is not authorization to drop data.
