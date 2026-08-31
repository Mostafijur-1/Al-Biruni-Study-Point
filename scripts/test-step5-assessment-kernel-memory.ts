import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

const databaseName = "absp_assessment_kernel_test";
const replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, dbName: databaseName, storageEngine: "wiredTiger" } });
try {
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ["--no-warnings", "--experimental-strip-types", "scripts/test-step5-assessment-kernel-db.ts"], {
      cwd: process.cwd(), env: { ...process.env, ASSESSMENT_TEST_MONGODB_URI: replicaSet.getUri(), ASSESSMENT_TEST_DB_NAME: databaseName }, stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => signal ? reject(new Error(`Step 5 DB harness stopped by ${signal}.`)) : resolve(code ?? 1));
  });
  if (exitCode !== 0) throw new Error(`Step 5 DB harness failed with exit code ${exitCode}.`);
} finally {
  await replicaSet.stop({ doCleanup: true, force: true });
}
