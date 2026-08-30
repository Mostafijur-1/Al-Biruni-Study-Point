import assert from "node:assert/strict";
import test from "node:test";

import { createTextPdf } from "../lib/simple-pdf.ts";
import { imagePagesToPdf } from "../lib/client-report-pdf.ts";

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

test("designed report PDF embeds every rendered A4 image as a page", () => {
  const pdf = imagePagesToPdf([
    new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  ]);
  const source = Buffer.from(pdf).toString("binary");
  assert.equal(source.slice(0, 8), "%PDF-1.4");
  assert.match(source, /\/Count 2/);
  assert.equal((source.match(/\/DCTDecode/g) ?? []).length, 2);
});
