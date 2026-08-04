export type AcademicReadinessInput = {
  approvedManifestValid: boolean;
  testMongoUriConfigured: boolean;
  testDatabaseName?: string;
  academicWritesEnabled: boolean;
};

export type AcademicReadinessCheck = {
  id: "approved-manifest" | "test-mongodb-uri" | "safe-test-database" | "writes-disabled";
  ready: boolean;
  detail: string;
};

export function isSafeAcademicTestDatabaseName(value: string | undefined) {
  return Boolean(value && /^absp_[a-z0-9_-]*test$/i.test(value) && value.toLowerCase() !== "absp");
}

export function evaluateAcademicReadiness(input: AcademicReadinessInput) {
  const checks: AcademicReadinessCheck[] = [
    {
      id: "approved-manifest",
      ready: input.approvedManifestValid,
      detail: input.approvedManifestValid
        ? "Approved bootstrap manifest is present and valid."
        : "A reviewed, non-placeholder bootstrap manifest is required.",
    },
    {
      id: "test-mongodb-uri",
      ready: input.testMongoUriConfigured,
      detail: input.testMongoUriConfigured
        ? "An isolated MongoDB URI is configured."
        : "ACADEMIC_TEST_MONGODB_URI is not configured.",
    },
    {
      id: "safe-test-database",
      ready: isSafeAcademicTestDatabaseName(input.testDatabaseName),
      detail: isSafeAcademicTestDatabaseName(input.testDatabaseName)
        ? "The database name matches the disposable absp_*test boundary."
        : "ACADEMIC_TEST_DB_NAME must match absp_*test.",
    },
    {
      id: "writes-disabled",
      ready: !input.academicWritesEnabled,
      detail: input.academicWritesEnabled
        ? "Disable academic writes until every external validation gate passes."
        : "Academic writes remain safely disabled.",
    },
  ];

  return {
    status: checks.every((check) => check.ready)
      ? "ready-for-external-validation" as const
      : "blocked" as const,
    checks,
    phase3Unlocked: false,
    remainingExternalGates: [
      "Run the disposable MongoDB integration harness.",
      "Run and review the staging bootstrap dry-run, then approved apply.",
      "Resolve canonical-versus-legacy teacher-scope parity.",
      "Complete authenticated mobile, desktop, keyboard, and screen-reader smoke checks.",
      "Record an explicit rollout decision before enabling academic writes or Phase 3.",
    ],
  };
}
