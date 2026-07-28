/**
 * Run synchronized exam-start and exam-submit bursts using unique students.
 * This intentionally excludes login so the authentication rate limiter does
 * not hide the capacity of the exam endpoints.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const baseUrl = normalizedBaseUrl(process.env.TARGET_BASE_URL || "http://localhost:3000");
const fixturePath = path.resolve(
  process.env.LOAD_TEST_FIXTURE || "scripts/load/fixture.json",
);
const stages = parseStages(process.env.LOAD_TEST_STAGES || "10,25,50,100,200");
const p95LimitMs = positiveNumber("LOAD_TEST_P95_MS", 2000);
const maxErrorRate = positiveNumber("LOAD_TEST_MAX_ERROR_RATE", 0.01);

guardRemoteTarget(baseUrl);

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const requiredStudents = stages.reduce((sum, value) => sum + value, 0);
if (!fixture.examId || !Array.isArray(fixture.students)) {
  throw new Error("The fixture is invalid. Run npm run load:seed first.");
}
if (fixture.students.length < requiredStudents) {
  throw new Error(
    `Stages require ${requiredStudents} unique students, but the fixture has ${fixture.students.length}. ` +
    `Set LOAD_TEST_STUDENTS=${requiredStudents} and run npm run load:seed again.`,
  );
}

console.log(`Target: ${baseUrl}`);
console.log(`Exam: ${fixture.examId}`);
console.log(`Thresholds: p95 <= ${p95LimitMs} ms; error rate <= ${maxErrorRate * 100}%`);

const results = [];
let offset = 0;

for (const concurrency of stages) {
  const students = fixture.students.slice(offset, offset + concurrency);
  offset += concurrency;

  const startPhase = await runStartPhase(students, fixture.examId);
  const successfulStarts = startPhase.operations.filter((operation) => operation.ok);
  const submitPhase = await runSubmitPhase(successfulStarts, fixture.examId);
  const combinedErrorRate =
    (startPhase.failed + submitPhase.failed) /
    Math.max(1, startPhase.total + submitPhase.total);
  const passed =
    startPhase.p95 <= p95LimitMs &&
    submitPhase.p95 <= p95LimitMs &&
    combinedErrorRate <= maxErrorRate;

  const stageResult = {
    concurrency,
    passed,
    combinedErrorRate,
    start: withoutOperations(startPhase),
    submit: withoutOperations(submitPhase),
  };
  results.push(stageResult);

  console.log(`\n${concurrency} simultaneous students: ${passed ? "PASS" : "FAIL"}`);
  printPhase("start", startPhase);
  printPhase("submit", submitPhase);
  console.log(`  combined errors: ${(combinedErrorRate * 100).toFixed(2)}%`);
}

const highestPassing = Math.max(
  0,
  ...results.filter((result) => result.passed).map((result) => result.concurrency),
);
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const resultPath = path.resolve(`scripts/load/results-${timestamp}.json`);
await writeFile(
  resultPath,
  `${JSON.stringify({ baseUrl, thresholds: { p95LimitMs, maxErrorRate }, highestPassing, results }, null, 2)}\n`,
);

console.log(`\nHighest passing tested concurrency: ${highestPassing}`);
console.log(`Results: ${resultPath}`);

async function runStartPhase(students, examId) {
  return runBurst(
    students.map((student) => async () => {
      const response = await timedFetch(`/api/mcq/exams/${examId}/start`, {
        headers: authHeaders(student.token),
      });
      let data = null;
      try {
        data = JSON.parse(response.body)?.data;
      } catch {
        // A non-JSON response is recorded as a failed operation below.
      }
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      return {
        ...response,
        ok: response.ok && questions.length > 0,
        token: student.token,
        questions,
      };
    }),
  );
}

async function runSubmitPhase(startOperations, examId) {
  return runBurst(
    startOperations.map((operation) => async () => {
      const answers = operation.questions.map((question, index) => ({
        questionId: question.id,
        selectedIndex: index % 4,
      }));
      return timedFetch(`/api/mcq/exams/${examId}/submit`, {
        method: "POST",
        headers: {
          ...authHeaders(operation.token),
          "content-type": "application/json",
        },
        body: JSON.stringify({ answers, timeTaken: 60 }),
      });
    }),
  );
}

async function runBurst(tasks) {
  let releaseGate;
  const gate = new Promise((resolve) => {
    releaseGate = resolve;
  });
  const operationsPromise = Promise.all(
    tasks.map(async (task) => {
      await gate;
      try {
        return await task();
      } catch (error) {
        return {
          ok: false,
          status: 0,
          durationMs: 0,
          body: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  const wallStart = performance.now();
  releaseGate();
  const operations = await operationsPromise;
  const wallDurationMs = performance.now() - wallStart;
  const durations = operations.map((operation) => operation.durationMs).sort((a, b) => a - b);
  const failed = operations.filter((operation) => !operation.ok).length;

  return {
    total: operations.length,
    failed,
    errorRate: failed / Math.max(1, operations.length),
    wallDurationMs: round(wallDurationMs),
    requestsPerSecond: round(operations.length / Math.max(0.001, wallDurationMs / 1000)),
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
    max: durations.at(-1) ?? 0,
    statuses: countStatuses(operations),
    operations,
  };
}

async function timedFetch(pathname, init) {
  const start = performance.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    durationMs: round(performance.now() - start),
    body,
  };
}

function authHeaders(token) {
  return { cookie: `absp_access_token=${token}` };
}

function printPhase(name, phase) {
  console.log(
    `  ${name.padEnd(6)} p50=${phase.p50}ms p95=${phase.p95}ms p99=${phase.p99}ms ` +
    `max=${phase.max}ms RPS=${phase.requestsPerSecond} failures=${phase.failed}/${phase.total}`,
  );
  console.log(`         statuses=${JSON.stringify(phase.statuses)}`);
}

function withoutOperations(phase) {
  const summary = { ...phase };
  delete summary.operations;
  return summary;
}

function countStatuses(operations) {
  return operations.reduce((counts, operation) => {
    counts[operation.status] = (counts[operation.status] || 0) + 1;
    return counts;
  }, {});
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function round(value) {
  return Number(value.toFixed(2));
}

function parseStages(value) {
  const parsed = value.split(",").map((item) => Number(item.trim()));
  if (parsed.length === 0 || parsed.some((item) => !Number.isInteger(item) || item < 1 || item > 5_000)) {
    throw new Error("LOAD_TEST_STAGES must be comma-separated integers from 1 to 5000.");
  }
  return parsed;
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be zero or greater.`);
  return value;
}

function normalizedBaseUrl(value) {
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}

function guardRemoteTarget(value) {
  const hostname = new URL(value).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!local && process.env.ALLOW_REMOTE_LOAD_TEST !== "true") {
    throw new Error(
      `Refusing to load-test remote target ${hostname}. ` +
      "Set ALLOW_REMOTE_LOAD_TEST=true only for an environment you are authorized to test.",
    );
  }
}
