import assert from "node:assert/strict";
import test from "node:test";

import { createTextPdf } from "../lib/simple-pdf.ts";

test("report PDF generator returns a valid paginated PDF document", () => {
  const pdf = createTextPdf("ABSP Student Progress Report", [{
    heading: "Attendance",
    lines: Array.from({ length: 60 }, (_, index) => `Class ${index + 1}: Present`),
  }]);
  assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
  assert.match(pdf.toString("binary"), /\/Count 2/);
  assert.match(pdf.toString("binary"), /%%EOF$/);
});

test("report PDF text is escaped instead of breaking PDF operators", () => {
  const pdf = createTextPdf("Report (verified)", [{ heading: "Comment", lines: ["Ready \\ checked"] }]);
  const source = pdf.toString("binary");
  assert.match(source, /Report \\\(verified\\\)/);
  assert.match(source, /Ready \\\\ checked/);
});
