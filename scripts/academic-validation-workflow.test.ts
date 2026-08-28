import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("academic DB validation stays manual, isolated, and reviewable", async () => {
  const workflow = await readFile(".github/workflows/phase2-academic-db.yml", "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /npm run test:academic-db:memory/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(
    workflow,
    /^\s{6}MONGOMS_DOWNLOAD_DIR:\s*\$\{\{\s*runner\./m,
    "runner context is unavailable in job-level env",
  );
  assert.match(
    workflow,
    /id: integration[\s\S]*?env:\s*\n\s{10}MONGOMS_DOWNLOAD_DIR:\s*\$\{\{\s*runner\.temp\s*\}\}\/mongodb-binaries/,
  );
});

test("normal dependency installs do not use the MongoDB binary postinstall package", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  assert.equal(packageJson.devDependencies?.["mongodb-memory-server"], undefined);
  assert.equal(packageJson.devDependencies?.["mongodb-memory-server-core"], "^11.2.0");
});

test("routine transaction reads remain sequential on their shared session", async () => {
  const source = await readFile("lib/academic-workflows.ts", "utf8");
  const createRoutine = source.slice(
    source.indexOf("export async function createRoutineSlot"),
    source.indexOf("export async function updateRoutineSlot"),
  );
  const updateRoutine = source.slice(
    source.indexOf("export async function updateRoutineSlot"),
    source.indexOf("export async function endRoutineSlot"),
  );
  assert.doesNotMatch(createRoutine, /Promise\.all/);
  assert.doesNotMatch(updateRoutine, /Promise\.all/);
});
