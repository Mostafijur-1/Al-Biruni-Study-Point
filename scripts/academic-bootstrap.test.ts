import assert from "node:assert/strict";
import test from "node:test";

import {
  academicBootstrapManifestSchema,
  resolveWorkspaceManifestPath,
} from "../lib/academic-bootstrap.ts";

const manifest = {
  organization: { name: "ABSP", slug: "absp" },
  branch: { name: "Main", code: "MAIN" },
  academicSession: {
    name: "2026",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T00:00:00.000Z",
  },
  subjects: [
    {
      code: "PHY",
      name: "Physics",
      nameBn: "পদার্থবিজ্ঞান",
      classLevels: ["class-9"],
    },
  ],
};

test("academic bootstrap accepts an explicit bounded manifest", () => {
  const parsed = academicBootstrapManifestSchema.parse(manifest);

  assert.equal(parsed.organization.timezone, "Asia/Dhaka");
  assert.ok(parsed.academicSession.startsAt instanceof Date);
  assert.deepEqual(parsed.subjects[0].aliases, []);
});

test("academic bootstrap rejects duplicate subject codes and inverted dates", () => {
  assert.equal(
    academicBootstrapManifestSchema.safeParse({
      ...manifest,
      academicSession: {
        ...manifest.academicSession,
        startsAt: manifest.academicSession.endsAt,
      },
      subjects: [manifest.subjects[0], { ...manifest.subjects[0], code: "phy" }],
    }).success,
    false,
  );
});

test("academic bootstrap rejects unreplaced example placeholders", () => {
  assert.equal(
    academicBootstrapManifestSchema.safeParse({
      ...manifest,
      branch: { name: "REPLACE WITH BRANCH", code: "MAIN" },
    }).success,
    false,
  );
});

test("bootstrap manifest paths cannot escape the workspace", () => {
  const resolved = resolveWorkspaceManifestPath("C:\\workspace", "docs\\manifest.json");
  assert.equal(resolved.relativePath, "docs\\manifest.json");
  assert.throws(() => resolveWorkspaceManifestPath("C:\\workspace", "..\\secrets.json"));
});
