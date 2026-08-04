export type AcademicReadinessInput = {
  approvedManifestValid: boolean;
  testMongoUriConfigured: boolean;
  testDatabaseName?: string;
  inMemoryReplicaSetAvailable?: boolean;
  academicWritesEnabled: boolean;
  externalEvidenceValid?: boolean;
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
  const disposableMongoAvailable =
    input.testMongoUriConfigured || input.inMemoryReplicaSetAvailable === true;
  const safeDisposableDatabase =
    (input.testMongoUriConfigured && isSafeAcademicTestDatabaseName(input.testDatabaseName)) ||
    input.inMemoryReplicaSetAvailable === true;
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
      ready: disposableMongoAvailable,
      detail: input.testMongoUriConfigured
        ? "An isolated MongoDB URI is configured."
        : input.inMemoryReplicaSetAvailable
          ? "The local disposable MongoDB replica-set harness is installed."
          : "No isolated MongoDB URI or in-memory replica-set harness is available.",
    },
    {
      id: "safe-test-database",
      ready: safeDisposableDatabase,
      detail: input.inMemoryReplicaSetAvailable && !input.testMongoUriConfigured
        ? "The in-memory harness uses the fixed disposable absp_academic_memory_test database."
        : isSafeAcademicTestDatabaseName(input.testDatabaseName)
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

  const prerequisitesReady = checks.every((check) => check.ready);
  const externalEvidenceValid = input.externalEvidenceValid === true;

  return {
    status: prerequisitesReady
      ? "ready-for-external-validation" as const
      : "blocked" as const,
    checks,
    externalEvidence: {
      valid: externalEvidenceValid,
      detail: externalEvidenceValid
        ? "All external gates and the academic-write rollout approval are recorded."
        : "Reviewed external-gate evidence is missing or invalid.",
    },
    rolloutEligibility:
      prerequisitesReady && externalEvidenceValid
        ? "eligible-for-explicit-phase3-authorization" as const
        : "not-eligible" as const,
    phase3Unlocked: false,
    remainingExternalGates: externalEvidenceValid
      ? ["Obtain explicit authorization to begin Phase 3 attendance work."]
      : [
          "Run the disposable MongoDB integration harness.",
          "Run and review the staging bootstrap dry-run, then approved apply.",
          "Resolve canonical-versus-legacy teacher-scope parity and complete shadow-read review.",
          "Complete authenticated mobile, desktop, keyboard, and screen-reader smoke checks.",
          "Record an explicit academic-write rollout decision in the reviewed evidence manifest.",
        ],
  };
}
