import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

const databaseName = "absp_canonical_scope_memory_test";
const replicaSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, dbName: databaseName, storageEngine: "wiredTiger" },
});

try {
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/test-step3-canonical-scope-db.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, ACADEMIC_TEST_MONGODB_URI: replicaSet.getUri(), ACADEMIC_TEST_DB_NAME: databaseName },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Step 3 DB harness stopped by ${signal}.`));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) throw new Error(`Step 3 DB harness failed with exit code ${exitCode}.`);
} finally {
  await replicaSet.stop({ doCleanup: true, force: true });
}
