import type { StudentReport } from "@/lib/student-report-service";

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN = 72;
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
  strokeColor?: string,
  strokeWidth = 1.5
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
    context.lineWidth = strokeWidth;
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
      context.font = "700 24px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillText("আল-বিরুনি স্টাডি পয়েন্ট — Student Progress Report (চলমান)", MARGIN, y + 20);
      y += 42;
      context.fillStyle = "#cbd5e1";
      context.fillRect(MARGIN, y, CONTENT_WIDTH, 2);
      y += 32;
    }
  }

  function ensureSpace(height: number) {
    if (y + height > PAGE_HEIGHT - MARGIN) {
      newPage(true);
    }
  }

  function sectionHeading(title: string, badgeText?: string) {
    ensureSpace(70);
    const barHeight = 48;
    drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, barHeight, 10, "#0b2545");
    context.font = "800 23px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText(title, MARGIN + 18, y + 32);

    if (badgeText) {
      context.font = "700 19px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      const textWidth = context.measureText(badgeText).width;
      const badgeWidth = textWidth + 28;
      const badgeX = MARGIN + CONTENT_WIDTH - badgeWidth - 12;
      drawRoundedRect(context, badgeX, y + 8, badgeWidth, 32, 8, "#ffffff");
      context.fillStyle = "#0b2545";
      context.fillText(badgeText, badgeX + 14, y + 30);
    }
    y += barHeight + 20;
  }

  function highlightLine(text: string) {
    ensureSpace(38);
    context.font = "600 22px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = "#1e293b";
    context.fillText(text, MARGIN + 4, y + 20);
    y += 34;
  }

  function renderStatCards(
    cards: Array<{ title: string; value: string; color: string; bg?: string; border?: string }>
  ) {
    ensureSpace(110);
    const gap = 18;
    const cardWidth = Math.floor((CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length);
    const cardHeight = 94;

    cards.forEach((card, idx) => {
      const cardX = MARGIN + idx * (cardWidth + gap);
      drawRoundedRect(
        context,
        cardX,
        y,
        cardWidth,
        cardHeight,
        14,
        card.bg ?? "#f8fafc",
        card.border ?? "#e2e8f0",
        1.5
      );
      // Title
      context.font = "600 17px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillStyle = "#64748b";
      context.fillText(card.title, cardX + 18, y + 32);
      // Value
      context.font = "800 32px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillStyle = card.color;
      context.fillText(card.value, cardX + 18, y + 74);
    });
    y += cardHeight + 28;
  }

  function renderSmartResultCard(item: {
    title: string;
    subject: string;
    date: string;
    scoreText: string;
    percentage: number;
    accentColor: string;
    comment?: string;
  }) {
    const hasComment = Boolean(item.comment);
    const cardHeight = hasComment ? 116 : 76;
    ensureSpace(cardHeight + 14);

    const cardY = y;
    drawRoundedRect(context, MARGIN, cardY, CONTENT_WIDTH, cardHeight, 12, "#ffffff", "#cbd5e1", 1.5);

    // Left accent vertical bar
    context.save();
    context.beginPath();
    context.moveTo(MARGIN + 12, cardY);
    context.lineTo(MARGIN + 7, cardY);
    context.lineTo(MARGIN + 7, cardY + cardHeight);
    context.lineTo(MARGIN + 12, cardY + cardHeight);
    context.closePath();
    context.fillStyle = item.accentColor;
    context.fill();
    context.restore();

    // Title
    context.font = "800 22px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = "#0b2545";
    context.fillText(item.title, MARGIN + 22, cardY + 30);

    // Subject and Date
    context.font = "600 17px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = "#64748b";
    context.fillText(`${item.subject}   •   তারিখ: ${item.date}`, MARGIN + 22, cardY + 56);

    // Right Side: Score Pill & Percentage Badge
    const pctBadgeWidth = 78;
    const pctBadgeX = MARGIN + CONTENT_WIDTH - pctBadgeWidth - 16;
    const pctBg = item.percentage >= 80 ? "#ecfdf5" : item.percentage >= 50 ? "#eff6ff" : "#fef2f2";
    const pctBorder = item.percentage >= 80 ? "#a7f3d0" : item.percentage >= 50 ? "#bfdbfe" : "#fecaca";
    const pctText = item.percentage >= 80 ? "#047857" : item.percentage >= 50 ? "#1d4ed8" : "#b91c1c";

    drawRoundedRect(context, pctBadgeX, cardY + 18, pctBadgeWidth, 40, 8, pctBg, pctBorder, 1.2);
    context.font = "800 21px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = pctText;
    const pctWidth = context.measureText(`${item.percentage}%`).width;
    context.fillText(`${item.percentage}%`, pctBadgeX + (pctBadgeWidth - pctWidth) / 2, cardY + 45);

    // Score pill
    context.font = "700 19px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    const scoreValWidth = context.measureText(item.scoreText).width;
    const scoreBoxWidth = scoreValWidth + 30;
    const scoreBoxX = pctBadgeX - scoreBoxWidth - 12;
    drawRoundedRect(context, scoreBoxX, cardY + 18, scoreBoxWidth, 40, 8, "#f8fafc", "#e2e8f0", 1.2);
    context.fillStyle = "#0b2545";
    context.fillText(item.scoreText, scoreBoxX + 15, cardY + 44);

    // Comment if exists
    if (hasComment && item.comment) {
      const commentY = cardY + 70;
      drawRoundedRect(context, MARGIN + 22, commentY, CONTENT_WIDTH - 44, 34, 6, "#f8fafc", "#e2e8f0", 1);
      context.font = "600 16px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillStyle = "#475569";
      context.fillText(`মন্তব্য: "${item.comment}"`, MARGIN + 32, commentY + 23);
    }

    y += cardHeight + 14;
  }

  function renderEmptyBox(message: string) {
    ensureSpace(70);
    drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, 64, 10, "#f8fafc", "#cbd5e1", 1);
    context.font = "600 18px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
    context.fillStyle = "#64748b";
    context.fillText(`• ${message}`, MARGIN + 24, y + 38);
    y += 78;
  }

  // --- PAGE 1: HEADER & CORE CONTENT ---
  newPage();

  // Top Header: ABSP Logo + Bangla Branding
  const logoSize = 92;
  if (logo) {
    try {
      context.drawImage(logo, MARGIN, y, logoSize, logoSize);
    } catch {
      // safe fallback if image draw encounters issue
    }
  }
  const textX = logo ? MARGIN + logoSize + 22 : MARGIN;
  context.font = "800 44px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#0b2545";
  context.fillText("আল-বিরুনি স্টাডি পয়েন্ট", textX, y + 44);

  context.font = "700 21px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("AL-BIRUNI STUDY POINT · Student Academic Progress Report", textX, y + 78);

  y += logoSize + 18;
  context.fillStyle = "#f5c518";
  context.fillRect(MARGIN, y, CONTENT_WIDTH, 5);
  y += 24;

  // Student Details Banner (Without Guardian Phone Number)
  const studentBoxHeight = 84;
  drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, studentBoxHeight, 14, "#f8fafc", "#cbd5e1", 1.5);
  context.font = "800 30px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#0b2545";
  context.fillText(report.student.name, MARGIN + 22, y + 36);

  context.font = "700 19px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#475569";
  const startDate = new Date(report.periodStart).toLocaleDateString("en-GB");
  const endDate = new Date(report.periodEnd).toLocaleDateString("en-GB");
  const studentMeta = `Student ID: ${report.student.studentCode || "—"}   |   ব্যাচ: ${report.batch.name}   |   সময়কাল: ${startDate} – ${endDate}`;
  context.fillText(studentMeta, MARGIN + 22, y + 66);
  y += studentBoxHeight + 22;

  // Guardian Greeting Callout (No phone number, smart and prominent)
  const greetingBoxHeight = 66;
  drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, greetingBoxHeight, 14, "#eff6ff", "#bfdbfe", 1.5);
  // Left blue decorative accent line
  context.fillStyle = "#2563eb";
  context.fillRect(MARGIN, y + 10, 6, greetingBoxHeight - 20);

  context.font = "700 24px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#1e3a8a";
  const periodLabel = report.periodType === "month" ? "এই মাসের" : "এই সপ্তাহের";
  context.fillText(
    `প্রিয় অভিভাবক, আপনার সন্তান ${report.student.name}-এর ${periodLabel} রিপোর্ট:`,
    MARGIN + 24,
    y + 41
  );
  y += greetingBoxHeight + 30;

  // --- SECTION 1: CLASS ATTENDANCE ---
  sectionHeading(
    "১. ক্লাস উপস্থিতি (Class Attendance)",
    report.attendance.percentage !== null ? `উপস্থিতির হার: ${report.attendance.percentage}%` : undefined
  );
  highlightLine(
    `Total Class হয়েছে ${report.attendance.total} টি, সে Present ছিল ${report.attendance.present} টি, সে Absent ছিল ${report.attendance.absent} টি।`
  );
  renderStatCards([
    {
      title: "Total Class হয়েছে",
      value: `${report.attendance.total} টি`,
      color: "#0b2545",
      bg: "#f8fafc",
      border: "#e2e8f0",
    },
    {
      title: "সে Present ছিল",
      value: `${report.attendance.present} টি`,
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    },
    {
      title: "সে Absent ছিল",
      value: `${report.attendance.absent} টি`,
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
    },
  ]);

  // --- SECTION 2: DAILY MCQ EXAM ---
  sectionHeading(
    "২. ডেইলি MCQ এক্সাম (Daily MCQ Exam)",
    report.dailyMcqPractice.averagePercent !== null
      ? `Overall Result: ${report.dailyMcqPractice.averagePercent}%`
      : undefined
  );
  highlightLine(
    `মোট ${report.dailyMcqPractice.totalDays} দিনের মধ্যে সে Daily MCQ Exam দিয়েছে ${report.dailyMcqPractice.daysAttended} দিন, Daily Exam মিস করেছে ${report.dailyMcqPractice.daysMissed} দিন।`
  );
  renderStatCards([
    {
      title: "Daily Exam দিয়েছে",
      value: `${report.dailyMcqPractice.daysAttended} দিন`,
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    },
    {
      title: "Daily Exam মিস করেছে",
      value: `${report.dailyMcqPractice.daysMissed} দিন`,
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
    },
    {
      title: "Overall Result (গড়)",
      value:
        report.dailyMcqPractice.averagePercent !== null
          ? `${report.dailyMcqPractice.averagePercent}%`
          : "—",
      color: "#0b2545",
      bg: "#f8fafc",
      border: "#e2e8f0",
    },
  ]);

  // --- SECTION 3: WEEKLY MCQ EXAM ---
  sectionHeading("৩. উইকলি MCQ টেস্ট (Weekly MCQ Exam)", `মোট: ${report.weeklyMcqSummary.total} টি`);
  highlightLine(
    `মোট ${report.weeklyMcqSummary.total} টির মধ্যে সে Weekly MCQ Exam দিয়েছে ${report.weeklyMcqSummary.attended} টি, Weekly MCQ Exam মিস করেছে ${report.weeklyMcqSummary.missed} টি।`
  );

  ensureSpace(42);
  context.font = "700 20px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("প্রতিটি পরীক্ষার বিস্তারিত ফলাফল:", MARGIN + 4, y + 20);
  y += 32;

  if (!report.weeklyMcqTests.length) {
    renderEmptyBox("এই সময়ে কোনো Weekly MCQ Exam অনুষ্ঠিত হয়নি বা Publish হয়নি।");
  } else {
    report.weeklyMcqTests.forEach((test) => {
      renderSmartResultCard({
        title: test.title,
        subject: test.subject,
        date: new Date(test.date).toLocaleDateString("en-GB"),
        scoreText: `প্রাপ্ত নম্বর: ${test.score} / ${test.totalMarks}`,
        percentage: test.percentage,
        accentColor: "#3b82f6",
      });
    });
    y += 16;
  }

  // --- SECTION 4: WRITTEN EXAM ---
  sectionHeading("৪. লিখিত পরীক্ষা (Written Exam)", `মোট: ${report.writtenExamSummary.total} টি`);
  highlightLine(
    `মোট ${report.writtenExamSummary.total} টির মধ্যে সে Written Exam দিয়েছে ${report.writtenExamSummary.attended} টি, Written Exam মিস করেছে ${report.writtenExamSummary.missed} টি।`
  );

  ensureSpace(42);
  context.font = "700 20px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#64748b";
  context.fillText("প্রতিটি লিখিত পরীক্ষার বিস্তারিত ফলাফল:", MARGIN + 4, y + 20);
  y += 32;

  if (!report.writtenExams.length) {
    renderEmptyBox("এই সময়ে কোনো Written Exam অনুষ্ঠিত হয়নি বা Publish হয়নি।");
  } else {
    report.writtenExams.forEach((exam) => {
      renderSmartResultCard({
        title: exam.title,
        subject: exam.subject,
        date: new Date(exam.date).toLocaleDateString("en-GB"),
        scoreText: `প্রাপ্ত নম্বর: ${exam.marks} / ${exam.totalMarks}`,
        percentage: exam.percentage,
        accentColor: "#f59e0b",
        comment: exam.comment,
      });
    });
    y += 16;
  }

  // --- SECTION 5: TEACHER COMMENTS ---
  sectionHeading("৫. শিক্ষক / কর্তৃপক্ষের মন্তব্য (Teacher Comments)");
  if (!report.comments.length) {
    renderEmptyBox("এই সময়ে কোনো বিশেষ মন্তব্য যোগ করা হয়নি।");
  } else {
    report.comments.forEach((row) => {
      ensureSpace(86);
      const cardHeight = 82;
      drawRoundedRect(context, MARGIN, y, CONTENT_WIDTH, cardHeight, 12, "#f8fafc", "#e2e8f0", 1.5);
      // Left yellow quote accent
      context.fillStyle = "#f5c518";
      context.fillRect(MARGIN, y + 10, 6, cardHeight - 20);

      context.font = "700 21px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillStyle = "#0b2545";
      context.fillText(`"${row.comment}"`, MARGIN + 22, y + 36);

      context.font = "600 17px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
      context.fillStyle = "#64748b";
      context.fillText(`— ${row.authorName} (${row.authorRole === "teacher" ? "শিক্ষক" : "কর্তৃপক্ষ"})`, MARGIN + 22, y + 64);
      y += cardHeight + 14;
    });
  }

  // --- FOOTER ---
  ensureSpace(80);
  y += 24;
  context.fillStyle = "#cbd5e1";
  context.fillRect(MARGIN, y, CONTENT_WIDTH, 2);
  y += 28;
  context.font = "600 18px 'Noto Sans Bengali', 'Nirmala UI', Arial, sans-serif";
  context.fillStyle = "#94a3b8";
  context.fillText(
    "আল-বিরুনি স্টাডি পয়েন্ট (ABSP) • ডিজিটাল একাডেমিক রিপোর্ট • www.abspoint.top",
    MARGIN + 4,
    y
  );

  const images = pages.map((page) => bytesFromBase64(page.toDataURL("image/jpeg", 0.92).split(",")[1]));
  const pdf = imagePagesToPdf(images);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ABSP-${report.student.studentCode ?? "student"}-${report.periodType}-report.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
}
