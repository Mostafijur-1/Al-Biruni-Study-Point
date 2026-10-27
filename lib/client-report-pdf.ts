import type { StudentReport } from "@/lib/student-report-service";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN = 80;
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
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

export function imagePagesToPdf(images: Uint8Array[]) {
  const objects: Uint8Array[] = [];
  const add = (body: string | Uint8Array) => {
    objects.push(typeof body === "string" ? textBytes(body) : body);
    return objects.length;
  };
  const catalogId = add("");
  const pagesId = add("");
  const pageIds: number[] = [];
  images.forEach((image) => {
    const imageId = add(
      concatBytes([
        textBytes(
          `<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`
        ),
        image,
        textBytes("\nendstream"),
      ])
    );
    const stream = "q\n595 0 0 842 0 0 cm\n/ReportImage Do\nQ";
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /ReportImage ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
      )
    );
  });
  objects[catalogId - 1] = textBytes(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[pagesId - 1] = textBytes(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );
  const chunks: Uint8Array[] = [textBytes("%PDF-1.4\n")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = concatBytes([textBytes(`${index + 1} 0 obj\n`), object, textBytes("\nendobj\n")]);
    chunks.push(chunk);
    length += chunk.length;
  });
  const xref = length;
  chunks.push(
    textBytes(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`
    )
  );
  return concatBytes(chunks);
}

function loadLogoImage(): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/absp-logo.png";
  });
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  if (fillColor) {
    context.fillStyle = fillColor;
    context.fill();
  }
  if (strokeColor) {
    context.strokeStyle = strokeColor;
    context.lineWidth = 1.5;
    context.stroke();
  }
}

export async function downloadStudentReportPdf(report: StudentReport) {
  await document.fonts.ready;
  const logo = await loadLogoImage();
  const pages: HTMLCanvasElement[] = [];
  let canvas!: HTMLCanvasElement;
  let context!: CanvasRenderingContext2D;
  let y = MARGIN;

  function newPage(continued = false) {
    canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const nextContext = canvas.getContext("2d");
    if (!nextContext) throw new Error("PDF canvas is unavailable.");
    context = nextContext;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    pages.push(canvas);
    y = MARGIN;
    if (continued) {
      context.fillStyle = "#0b2545";
      context.font = "700 22px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillText("আল-বিরুনী স্টাডি পয়েন্ট — Student Progress Report (চলমান)", MARGIN, y);
      y += 36;
      context.fillStyle = "#dce5ee";
      context.fillRect(MARGIN, y, CONTENT_WIDTH, 2);
      y += 24;
    }
  }

  function ensureSpace(height: number) {
    if (y + height > PAGE_HEIGHT - MARGIN) {
      newPage(true);
    }
  }

  function line(
    value: string,
    options?: { size?: number; weight?: number | string; color?: string; indent?: number; lineHeight?: number }
  ) {
    const size = options?.size ?? 23;
    const indent = options?.indent ?? 0;
    const lineHeight = options?.lineHeight ?? size + 10;
    context.font = `${options?.weight ?? 400} ${size}px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif`;
    context.fillStyle = options?.color ?? "#1e293b";
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = `${current} ${word}`.trim();
      if (context.measureText(candidate).width > CONTENT_WIDTH - indent && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    ensureSpace(lines.length * lineHeight);
    lines.forEach((row) => {
      context.fillText(row, MARGIN + indent, y);
      y += lineHeight;
    });
  }

  function sectionHeading(title: string, badgeText?: string) {
    ensureSpace(60);
    y += 12;
    drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, 38, 8, "#f1f5f9", "#e2e8f0");
    context.font = "700 22px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = "#0b2545";
    context.fillText(title, MARGIN + 14, y + 26);
    if (badgeText) {
      context.font = "700 18px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      const badgeWidth = context.measureText(badgeText).width + 24;
      const badgeX = MARGIN + CONTENT_WIDTH - badgeWidth - 10;
      drawRoundedRect(context, badgeX, y + 5, badgeWidth, 28, 6, "#e0f2fe", "#93c5fd");
      context.fillStyle = "#0369a1";
      context.fillText(badgeText, badgeX + 12, y + 24);
    }
    y += 50;
  }

  function renderStatCards(cards: Array<{ title: string; value: string; color?: string }>) {
    ensureSpace(80);
    const gap = 16;
    const cardWidth = Math.floor((CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length);
    const cardHeight = 70;
    cards.forEach((card, idx) => {
      const cardX = MARGIN + idx * (cardWidth + gap);
      drawRoundedRect(context, cardX, y, cardWidth, cardHeight, 10, "#f8fafc", "#e2e8f0");
      context.font = "600 16px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillStyle = "#64748b";
      context.fillText(card.title, cardX + 14, y + 26);
      context.font = "800 24px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillStyle = card.color ?? "#0b2545";
      context.fillText(card.value, cardX + 14, y + 56);
    });
    y += cardHeight + 16;
  }

  // --- PAGE 1: HEADER & CORE CONTENT ---
  newPage();

  // Top branding: Logo + Bangla Center Name + Subtitle
  const logoSize = 88;
  if (logo) {
    try {
      context.drawImage(logo, MARGIN, y, logoSize, logoSize);
    } catch {
      // Fallback if image draw encounters canvas cross-origin
    }
  }
  const textX = logo ? MARGIN + logoSize + 20 : MARGIN;
  context.font = "800 40px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#0b2545";
  context.fillText("আল-বিরুনী স্টাডি পয়েন্ট", textX, y + 42);

  context.font = "700 20px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("AL-BIRUNI STUDY POINT · Student Progress Report", textX, y + 74);

  y += logoSize + 16;
  context.fillStyle = "#f5c518";
  context.fillRect(MARGIN, y, CONTENT_WIDTH, 4);
  y += 20;

  // Student details box
  drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, 84, 12, "#f8fafc", "#cbd5e1");
  context.font = "800 26px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#0b2545";
  context.fillText(report.student.name, MARGIN + 18, y + 36);

  context.font = "600 18px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#475569";
  const studentMeta = `Student ID: ${report.student.studentCode || "—"}   |   ব্যাচ: ${report.batch.name}   |   সময়কাল: ${new Date(report.periodStart).toLocaleDateString("en-GB")} – ${new Date(report.periodEnd).toLocaleDateString("en-GB")}`;
  context.fillText(studentMeta, MARGIN + 18, y + 66);
  y += 98;

  // Guardian Greeting
  drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, 68, 12, "#eff6ff", "#bfdbfe");
  context.font = "700 22px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#1e3a8a";
  const periodLabel = report.periodType === "month" ? "এই মাসের" : "এই সপ্তাহের";
  context.fillText(
    `প্রিয় অভিভাবক, আপনার সন্তান ${report.student.name}-এর ${periodLabel} রিপোর্ট:`,
    MARGIN + 18,
    y + 34
  );
  if (report.guardian.phone) {
    context.font = "500 16px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = "#3b82f6";
    context.fillText(
      `অভিভাবক মোবাইল: ${report.guardian.phone}${report.guardian.relation ? ` (${report.guardian.relation})` : ""}`,
      MARGIN + 18,
      y + 56
    );
  }
  y += 82;

  // --- 1. CLASS ATTENDANCE ---
  sectionHeading(
    "১. ক্লাস উপস্থিতি (Class Attendance)",
    report.attendance.percentage !== null ? `উপস্থিতির হার: ${report.attendance.percentage}%` : undefined
  );
  line(
    `Total Class হয়েছে ${report.attendance.total} টি, সে Present ছিল ${report.attendance.present} টি, সে Absent ছিল ${report.attendance.absent} টি।`,
    { size: 21, weight: 600, color: "#1e293b" }
  );
  y += 6;
  renderStatCards([
    { title: "Total Class হয়েছে", value: `${report.attendance.total} টি`, color: "#0b2545" },
    { title: "সে Present ছিল", value: `${report.attendance.present} টি`, color: "#16a34a" },
    { title: "সে Absent ছিল", value: `${report.attendance.absent} টি`, color: "#dc2626" },
  ]);

  // --- 2. DAILY MCQ EXAM ---
  sectionHeading(
    "২. ডেইলি MCQ এক্সাম (Daily MCQ Exam)",
    report.dailyMcqPractice.averagePercent !== null ? `Overall Result: ${report.dailyMcqPractice.averagePercent}%` : undefined
  );
  line(
    `মোট ${report.dailyMcqPractice.totalDays} দিনের মধ্যে সে Daily MCQ Exam দিয়েছে ${report.dailyMcqPractice.daysAttended} দিন, Daily Exam মিস করেছে ${report.dailyMcqPractice.daysMissed} দিন।`,
    { size: 21, weight: 600, color: "#1e293b" }
  );
  y += 6;
  renderStatCards([
    { title: "Daily Exam দিয়েছে", value: `${report.dailyMcqPractice.daysAttended} দিন`, color: "#16a34a" },
    { title: "Daily Exam মিস করেছে", value: `${report.dailyMcqPractice.daysMissed} দিন`, color: "#dc2626" },
    {
      title: "Overall Result (গড়)",
      value: report.dailyMcqPractice.averagePercent !== null ? `${report.dailyMcqPractice.averagePercent}%` : "—",
      color: "#0b2545",
    },
  ]);

  // --- 3. WEEKLY MCQ EXAM ---
  sectionHeading("৩. উইকলি MCQ টেস্ট (Weekly MCQ Exam)", `মোট: ${report.weeklyMcqSummary.total} টি`);
  line(
    `মোট ${report.weeklyMcqSummary.total} টির মধ্যে সে Weekly MCQ Exam দিয়েছে ${report.weeklyMcqSummary.attended} টি, Weekly MCQ Exam মিস করেছে ${report.weeklyMcqSummary.missed} টি।`,
    { size: 21, weight: 600, color: "#1e293b" }
  );
  y += 10;
  line("প্রতিটি পরীক্ষার ফলাফল আলাদাভাবে:", { size: 19, weight: 700, color: "#64748b" });
  if (!report.weeklyMcqTests.length) {
    line("• এই সময়ে কোনো Weekly MCQ Exam দেওয়া হয়নি বা Publish হয়নি।", { size: 19, color: "#94a3b8", indent: 14 });
  } else {
    report.weeklyMcqTests.forEach((test) => {
      const dateStr = new Date(test.date).toLocaleDateString("en-GB");
      line(
        `• ${test.title} (${test.subject}) — প্রাপ্ত নম্বর: ${test.score}/${test.totalMarks} (${test.percentage}%)  ·  তারিখ: ${dateStr}`,
        { size: 20, weight: 600, color: "#0b2545", indent: 14 }
      );
    });
  }

  // --- 4. WRITTEN EXAM ---
  sectionHeading("৪. লিখিত পরীক্ষা (Written Exam)", `মোট: ${report.writtenExamSummary.total} টি`);
  line(
    `মোট ${report.writtenExamSummary.total} টির মধ্যে সে Written Exam দিয়েছে ${report.writtenExamSummary.attended} টি, Written Exam মিস করেছে ${report.writtenExamSummary.missed} টি।`,
    { size: 21, weight: 600, color: "#1e293b" }
  );
  y += 10;
  line("প্রতিটি লিখিত পরীক্ষার ফলাফল আলাদাভাবে:", { size: 19, weight: 700, color: "#64748b" });
  if (!report.writtenExams.length) {
    line("• এই সময়ে কোনো Written Exam দেওয়া হয়নি বা Publish হয়নি।", { size: 19, color: "#94a3b8", indent: 14 });
  } else {
    report.writtenExams.forEach((exam) => {
      const dateStr = new Date(exam.date).toLocaleDateString("en-GB");
      line(
        `• ${exam.title} (${exam.subject}) — প্রাপ্ত নম্বর: ${exam.marks}/${exam.totalMarks} (${exam.percentage}%)  ·  তারিখ: ${dateStr}`,
        { size: 20, weight: 600, color: "#0b2545", indent: 14 }
      );
      if (exam.comment) {
        line(`মন্তব্য: ${exam.comment}`, { size: 18, color: "#475569", indent: 36 });
      }
    });
  }

  // --- 5. TEACHER COMMENTS ---
  sectionHeading("৫. শিক্ষক / কর্তৃপক্ষের মন্তব্য (Teacher Comments)");
  if (!report.comments.length) {
    line("• এই সময়ে কোনো মন্তব্য যোগ করা হয়নি।", { size: 19, color: "#94a3b8", indent: 14 });
  } else {
    report.comments.forEach((row) => {
      line(`"${row.comment}"`, { size: 20, weight: 600, color: "#0b2545", indent: 14 });
      line(`— ${row.authorName} (${row.authorRole})`, { size: 18, color: "#64748b", indent: 32 });
      y += 6;
    });
  }

  ensureSpace(70);
  y += 16;
  context.fillStyle = "#e2e8f0";
  context.fillRect(MARGIN, y, CONTENT_WIDTH, 1.5);
  y += 24;
  line("Al-Biruni Study Point (ABSP) • স্বয়ংক্রিয় ডিজিটাল একাডেমিক রিপোর্ট", {
    size: 17,
    color: "#94a3b8",
  });

  const images = pages.map((page) => bytesFromBase64(page.toDataURL("image/jpeg", 0.92).split(",")[1]));
  const pdf = imagePagesToPdf(images);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ABSP-${report.student.studentCode ?? "student"}-${report.periodType}-report.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
}
