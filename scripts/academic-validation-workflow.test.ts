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
});

test("normal dependency installs do not use the MongoDB binary postinstall package", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  assert.equal(packageJson.devDependencies?.["mongodb-memory-server"], undefined);
  assert.equal(packageJson.devDependencies?.["mongodb-memory-server-core"], "^11.2.0");
});
