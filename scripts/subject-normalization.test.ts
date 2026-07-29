import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalSubjectName,
  getSubjectAliases,
  getUniqueSubjectNames,
  isSameSubject,
} from "../lib/content/syllabus.ts";

test("English and Bangla subject aliases share one canonical name", () => {
  assert.equal(getCanonicalSubjectName("Physics"), "পদার্থবিজ্ঞান");
  assert.equal(
    getCanonicalSubjectName("Chemistry 1st Paper"),
    "রসায়ন ১ম পত্র",
  );
  assert.equal(isSameSubject("ICT", "তথ্য ও যোগাযোগ প্রযুক্তি"), true);
});

test("subject choices remove bilingual duplicates without merging papers", () => {
  assert.deepEqual(
    getUniqueSubjectNames([
      "Physics",
      "পদার্থবিজ্ঞান",
      "Chemistry 1st Paper",
      "রসায়ন ১ম পত্র",
      "Chemistry 2nd Paper",
    ]),
    ["পদার্থবিজ্ঞান", "রসায়ন ১ম পত্র", "রসায়ন ২য় পত্র"],
  );
});

test("canonical subject queries still include every stored alias", () => {
  assert.deepEqual(
    new Set(getSubjectAliases("পদার্থবিজ্ঞান")),
    new Set(["পদার্থবিজ্ঞান", "Physics"]),
  );
  assert.deepEqual(
    new Set(getSubjectAliases("Physics")),
    new Set(["পদার্থবিজ্ঞান", "Physics"]),
  );
});
