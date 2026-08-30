import type { StudentReport } from "@/lib/student-report-service";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN = 88;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

export function imagePagesToPdf(images: Uint8Array[]) {
  const objects: Uint8Array[] = [];
  const add = (body: string | Uint8Array) => { objects.push(typeof body === "string" ? textBytes(body) : body); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const pageIds: number[] = [];
  images.forEach((image) => {
    const imageId = add(concatBytes([
      textBytes(`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),
      image,
      textBytes("\nendstream"),
    ]));
    const stream = "q\n595 0 0 842 0 0 cm\n/ReportImage Do\nQ";
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /ReportImage ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });
  objects[catalogId - 1] = textBytes(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[pagesId - 1] = textBytes(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const chunks: Uint8Array[] = [textBytes("%PDF-1.4\n")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = concatBytes([textBytes(`${index + 1} 0 obj\n`), object, textBytes("\nendobj\n")]);
    chunks.push(chunk); length += chunk.length;
  });
  const xref = length;
  chunks.push(textBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return concatBytes(chunks);
}

export async function downloadStudentReportPdf(report: StudentReport) {
  await document.fonts.ready;
  const pages: HTMLCanvasElement[] = [];
  let canvas!: HTMLCanvasElement;
  let context!: CanvasRenderingContext2D;
  let y = MARGIN;

  function newPage(continued = false) {
    canvas = document.createElement("canvas"); canvas.width = PAGE_WIDTH; canvas.height = PAGE_HEIGHT;
    const nextContext = canvas.getContext("2d");
    if (!nextContext) throw new Error("PDF canvas is unavailable.");
    context = nextContext; context.fillStyle = "#ffffff"; context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    pages.push(canvas); y = MARGIN;
    if (continued) { context.fillStyle = "#0b2545"; context.font = "700 24px 'Noto Sans Bengali', 'Nirmala UI', sans-serif"; context.fillText("ABSP Student Progress Report — continued", MARGIN, y); y += 54; }
  }

  function ensureSpace(height: number) { if (y + height > PAGE_HEIGHT - MARGIN) newPage(true); }
  function line(value: string, options?: { size?: number; weight?: number; color?: string; indent?: number }) {
    const size = options?.size ?? 25; const indent = options?.indent ?? 0;
    context.font = `${options?.weight ?? 400} ${size}px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif`;
    context.fillStyle = options?.color ?? "#24364b";
    const words = value.split(/\s+/); const lines: string[] = []; let current = "";
    for (const word of words) {
      const candidate = `${current} ${word}`.trim();
      if (context.measureText(candidate).width > CONTENT_WIDTH - indent && current) { lines.push(current); current = word; } else current = candidate;
    }
    if (current) lines.push(current);
    ensureSpace(lines.length * (size + 10));
    lines.forEach((row) => { context.fillText(row, MARGIN + indent, y); y += size + 10; });
  }
  function heading(value: string) { ensureSpace(62); y += 16; line(value, { size: 28, weight: 700, color: "#0b2545" }); }
  function divider() { context.fillStyle = "#dce5ee"; context.fillRect(MARGIN, y + 5, CONTENT_WIDTH, 2); y += 28; }

  newPage();
  context.fillStyle = "#0b2545"; context.fillRect(0, 0, PAGE_WIDTH, 250);
  context.fillStyle = "#ffc628"; context.fillRect(0, 240, PAGE_WIDTH, 10);
  y = 88; line("AL-BIRUNI STUDY POINT", { size: 23, weight: 700, color: "#ffc628" });
  line(`${report.periodType === "month" ? "Monthly" : "Weekly"} Student Progress Report`, { size: 45, weight: 700, color: "#ffffff" });
  y = 300;
  line(report.student.name, { size: 38, weight: 700, color: "#0b2545" });
  line(`Student ID: ${report.student.studentCode ?? "Not assigned"}  •  Batch: ${report.batch.name}`, { size: 24 });
  line(`Period: ${new Date(report.periodStart).toLocaleDateString("en-GB")} – ${new Date(report.periodEnd).toLocaleDateString("en-GB")}`, { size: 23 });
  line(`Guardian: ${report.guardian.phone || "Not recorded"}${report.guardian.relation ? ` (${report.guardian.relation})` : ""}`, { size: 23 });
  divider();
  heading("Performance summary");
  line(`Attendance ${report.attendance.percentage ?? "—"}%  |  P ${report.attendance.present}  A ${report.attendance.absent}  L ${report.attendance.late}  E ${report.attendance.excused}`, { weight: 700 });
  line(`Daily MCQ practice: ${report.dailyMcqPractice.attempts} attempts  |  Average ${report.dailyMcqPractice.averagePercent ?? "—"}%  |  Best ${report.dailyMcqPractice.bestPercent ?? "—"}%`);
  heading("Published weekly MCQ tests");
  if (!report.weeklyMcqTests.length) line("No published MCQ test result in this period.", { color: "#65758b" });
  report.weeklyMcqTests.forEach((row) => line(`• ${row.subject} — ${row.title}: ${row.score}/${row.totalMarks} (${row.percentage}%)`, { indent: 10 }));
  heading("Published written exams");
  if (!report.writtenExams.length) line("No published written-exam result in this period.", { color: "#65758b" });
  report.writtenExams.forEach((row) => { line(`• ${row.subject} — ${row.title}: ${row.marks}/${row.totalMarks} (${row.percentage}%)`, { indent: 10 }); if (row.comment) line(`Comment: ${row.comment}`, { size: 22, indent: 32, color: "#52657b" }); });
  if (report.weeklyBreakdown.length) {
    heading("Monthly weekly breakdown");
    report.weeklyBreakdown.forEach((week) => line(`${new Date(week.start).toLocaleDateString("en-GB")} – ${new Date(week.end).toLocaleDateString("en-GB")}  |  Attendance ${week.attendancePercent ?? "—"}%  Practice ${week.practiceAverage ?? "—"}%  MCQ ${week.mcqTestAverage ?? "—"}%  Written ${week.writtenAverage ?? "—"}%`, { size: 21 }));
  }
  heading("Teacher / Admin comments");
  if (!report.comments.length) line("No comment for this report period.", { color: "#65758b" });
  report.comments.forEach((row) => { line(row.comment, { weight: 600 }); line(`— ${row.authorName}, ${row.authorRole}`, { size: 20, color: "#65758b" }); });
  ensureSpace(80); divider(); line("Generated securely from the ABSP academic dashboard.", { size: 19, color: "#65758b" });

  const images = pages.map((page) => bytesFromBase64(page.toDataURL("image/jpeg", 0.92).split(",")[1]));
  const pdf = imagePagesToPdf(images);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ABSP-${report.student.studentCode ?? "student"}-${report.periodType}-report.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
}
