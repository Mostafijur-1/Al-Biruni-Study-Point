# Deploy ABSP

## cPanel Deployment Guide for Procloudify (abspoint.top)

The application runs as a production Node.js application managed by CloudLinux Phusion Passenger in cPanel.

There are two recommended deployment workflows:
- **Method A (Recommended for Shared Hosting)**: Build locally using `npm run package:cpanel`, upload `cpanel-deploy.zip` to cPanel, extract, run `npm install --omit=dev`, and start the app. This avoids out-of-memory (OOM) errors during Next.js compilation on memory-limited cPanel accounts.
- **Method B (Git Version Control)**: Push to GitHub and deploy directly in cPanel via Git Version Control using `.cpanel.yml`.

---

### Prerequisites & cPanel Setup

1. **Domain & DNS**:
   - In your domain registrar (or DNS zone editor), ensure `abspoint.top` and `www.abspoint.top` have an `A` record pointing to your Procloudify server IP.
   - Run cPanel **AutoSSL** (or Let's Encrypt SSL) to enable HTTPS on `abspoint.top`.

2. **Setup Node.js App in cPanel**:
   - In cPanel, navigate to **Software** -> **Setup Node.js App**.
   - Click **Create Application**.
   - **Node.js version**: Choose `20.x` or `22.x` (LTS recommended).
   - **Application mode**: `Production`.
   - **Application root**: e.g., `abspoint.top` (or `repositories/Al-Biruni-Study-Point`).
   - **Application URL**: `abspoint.top`.
   - **Application startup file**: `app.js`.
   - Click **Create**.
   - (Optional) Copy the command shown at the top of the page to enter the virtual environment via SSH/terminal (e.g. `source /home/<username>/nodevenv/abspoint.top/.../bin/activate`).

3. **Configure Environment Variables**:
   In the same Node.js App page, scroll down to **Environment variables** (or click **Add Variable**), and configure:
   - `NODE_ENV`: `production`
   - `NEXT_PUBLIC_APP_URL`: `https://abspoint.top`
   - `NEXT_PUBLIC_DEFAULT_LOCALE`: `bn`
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/absp?retryWrites=true&w=majority`
   - `JWT_ACCESS_SECRET`: `<minimum 32 random characters>`
   - `JWT_REFRESH_SECRET`: `<different minimum 32 random characters>`
   - `JWT_ACCESS_EXPIRES`: `15m`
   - `JWT_REFRESH_EXPIRES`: `30d`
   - (Optional) `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - (Optional) `GROQ_API_KEYS`, `GEMINI_API_KEYS`, `OPENROUTER_API_KEY`
   *(Refer to `.env.cpanel.example` for the complete list of variables)*.

---

### Method A: Upload Pre-built Zip Package (Recommended)

1. On your local machine, run:
   ```bash
   npm run package:cpanel
   ```
   This compiles the optimized production build and bundles `app.js`, `.next/`, `public/`, `.htaccess`, `package.json`, and `package-lock.json` into `cpanel-deploy.zip` (~8 MB).

2. Open **cPanel File Manager** and open your Application Root directory (e.g., `/home/<username>/abspoint.top`).
3. Upload `cpanel-deploy.zip` and extract its contents into the Application Root directory.
4. Go back to **Setup Node.js App**, open your application, and click **Run NPM Install** (or run `npm install --omit=dev` via terminal).
5. Click **Restart Application**.
6. Visit `https://abspoint.top` to verify!

---

### Method B: Git Version Control with `.cpanel.yml`

If your Procloudify hosting account has sufficient RAM (2 GB+ memory limit) to build on the server:

1. In cPanel, navigate to **Files** -> **Git™ Version Control**.
2. Clone your repository into your desired path (e.g., `/home/<username>/repositories/Al-Biruni-Study-Point`).
3. Ensure the Application Root in **Setup Node.js App** points to this repository directory and `app.js` is the startup file.
4. Under **Manage** -> **Pull or Deploy**, click **Deploy HEAD Commit**.
   cPanel will run `.cpanel.yml`, which:
   - Verifies Node.js and npm
   - Installs dependencies
   - Executes `npm run build:cpanel` (with Webpack and memory optimizations)
   - Restarts Passenger via `tmp/restart.txt`.


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
