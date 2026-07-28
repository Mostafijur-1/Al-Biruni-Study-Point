# MCQ exam load testing

This test measures how many students can start and submit the same MCQ exam at
the same time. It tests the API and database path rather than browser rendering.

Use an isolated staging deployment and staging database. Do not point the test
at production while real students are active.

## What the test does

1. Seeds one synthetic teacher, one published exam, synthetic questions, and a
   configurable number of synthetic students.
2. Creates short-lived access tokens so login rate limiting does not distort the
   exam measurement.
3. Runs stages of synchronized `start` requests followed by synchronized
   `submit` requests.
4. Reports p50, p95, p99, throughput, HTTP statuses, and error rate.

Each stage uses different students because the application permits one attempt
per student and exam. Reseeding resets attempts only for the synthetic exam.

## Run locally or against staging

Build and start the application in production mode in one terminal:

```powershell
npm run build
npm run start
```

In another terminal, seed enough students for all stages. The default stages
need 385 students, so the default seed of 500 is sufficient:

```powershell
$env:ALLOW_LOAD_TEST_SEED = "true"
npm run load:seed
npm run load:exam
```

For a staging deployment:

```powershell
$env:TARGET_BASE_URL = "https://your-staging-host.example"
$env:ALLOW_REMOTE_LOAD_TEST = "true"
npm run load:exam
```

The seed command reads `MONGODB_URI` and `JWT_ACCESS_SECRET` from `.env.local`.
When targeting staging, those values must correspond to that staging deployment.

## Configure the ramp and acceptance threshold

```powershell
$env:LOAD_TEST_STUDENTS = "1000"
$env:LOAD_TEST_STAGES = "25,50,100,200,400"
$env:LOAD_TEST_P95_MS = "2000"
$env:LOAD_TEST_MAX_ERROR_RATE = "0.01"
$env:ALLOW_LOAD_TEST_SEED = "true"
npm run load:seed
npm run load:exam
```

`LOAD_TEST_STUDENTS` must be at least the sum of all stages because students are
not reused. A stage passes when both start and submit p95 latency are within the
configured limit and their combined error rate is within the configured limit.
The highest passing stage is the tested concurrency capacity, not a guarantee
beyond that number.

## Interpreting results

- Run from a machine outside the hosting provider's network when measuring the
  real student experience.
- Repeat each test at least three times and use the lowest stable result.
- Monitor Vercel function duration/error metrics and MongoDB Atlas connections,
  CPU, operation latency, and throttling during the run.
- Test a question count representative of the real exam. Larger exams increase
  response size and submission work.
- Keep at least 30% safety headroom. If 200 students is the highest stable stage,
  schedule no more than roughly 140 simultaneous starts until another test
  validates a higher limit.
- A load generator with insufficient CPU or network bandwidth can become the
  bottleneck. For high stages, confirm the generator is not saturated or use a
  distributed load-testing service.

The generated fixture and result files are ignored by Git because the fixture
contains temporary access tokens.

The seeder refuses to write unless `ALLOW_LOAD_TEST_SEED=true`. Set that flag
only after verifying that `MONGODB_URI` identifies an isolated test database.
