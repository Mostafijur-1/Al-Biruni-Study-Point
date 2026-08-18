import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { ReportedQuestion } from "@/lib/db/models/ReportedQuestion";
import type { IPracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { COURSE_TO_MCQ_SUBJECT_MAP } from "@/lib/content/syllabus";

type ReportRow = {
  _id: { toString(): string };
  questionId: { toString(): string };
  studentId: unknown;
  comment: string;
  resolved: boolean;
  createdAt: Date;
  sourceType?: "practice" | "exam";
  sourceOwnerId?: { toString(): string };
  sourceTitle?: string;
  questionSnapshot?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  };
};

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const sessionUser = await requireAuth(request, ["teacher"]);
    
    // Retrieve full user to get teacherDomain
    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const domain = user.teacherDomain;
    const allowedLevels: string[] = [];
    if (domain?.isAll) {
      allowedLevels.push("ssc", "hsc");
    } else {
      if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
      if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");
    }

    const reports = await ReportedQuestion.find({ resolved: false })
      .populate({
        path: "studentId",
        model: "User",
        select: "name email"
      })
      .sort({ createdAt: -1 })
      .lean<ReportRow[]>();

    const practiceQuestionIds = reports
      .filter((report) => (report.sourceType ?? "practice") === "practice")
      .map((report) => report.questionId.toString());
    const practiceQuestions = await PracticeQuestion.find({
      _id: { $in: practiceQuestionIds },
    }).lean();
    const practiceQuestionMap = new Map(
      practiceQuestions.map((question) => [question._id.toString(), question]),
    );

    const hydratedReports = reports.map((report) => {
      if (report.sourceType === "exam") {
        const snapshot = report.questionSnapshot;
        return {
          ...report,
          sourceType: "exam" as const,
          questionId: snapshot
            ? {
                _id: report.questionId.toString(),
                level: "exam",
                subject: report.sourceTitle || "Official Exam",
                chapter: "Reported question",
                ...snapshot,
              }
            : null,
        };
      }
      return {
        ...report,
        sourceType: "practice" as const,
        questionId: practiceQuestionMap.get(report.questionId.toString()) ?? null,
      };
    });

    // Filter reports to match teacher's domain classes and subjects
    const filteredReports = hydratedReports.filter((report) => {
      const q = report.questionId;
      if (!q) return false;

      if (report.sourceType === "exam") {
        return report.sourceOwnerId?.toString() === sessionUser.id;
      }

      if (domain?.isAll) return true;

      const levelAllowed = allowedLevels.includes(q.level);
      // domain.subjects stores English names; q.subject is Bengali
      let subjectAllowed = false;
      if (domain?.subjects && domain.subjects.length > 0) {
        const mapping = COURSE_TO_MCQ_SUBJECT_MAP[q.level as "ssc" | "hsc"] || {};
        subjectAllowed = domain.subjects.some((engSub) => {
          const bengaliNames = mapping[engSub];
          return Array.isArray(bengaliNames) && bengaliNames.includes(q.subject);
        });
        if (!subjectAllowed) subjectAllowed = domain.subjects.includes(q.subject);
      }
      return levelAllowed && subjectAllowed;
    });

    return success({
      reports: filteredReports,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const resolveReportSchema = z.object({
  reportId: z.string(),
});

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const sessionUser = await requireAuth(request, ["teacher"]);

    const body = await request.json();
    const parsed = resolveReportSchema.parse(body);

    // Retrieve full user to get teacherDomain
    const user = await User.findById(sessionUser.id).lean();
    if (!user) {
      return fail("User not found", 404);
    }

    const report = await ReportedQuestion.findById(parsed.reportId);
    if (!report) {
      return fail("Report not found", 404);
    }

    if (report.sourceType === "exam") {
      if (report.sourceOwnerId?.toString() !== sessionUser.id) {
        return fail("Access denied to this Exam report", 403);
      }
      report.resolved = true;
      await report.save();
      return success({ message: "Report marked as resolved successfully." });
    }

    const question = await PracticeQuestion.findById(
      report.questionId,
    ) as IPracticeQuestion | null;
    if (!question) {
      return fail("Reported question not found", 404);
    }

    const isCreator = question.createdBy && String(question.createdBy) === String(user._id);
    if (!isCreator) {
        const domain = user.teacherDomain;
        let allowed = false;
        if (domain?.isAll) {
          allowed = true;
        } else {
          const allowedLevels: string[] = [];
          if (domain?.classes?.some(c => c === "class-9" || c === "class-10")) allowedLevels.push("ssc");
          if (domain?.classes?.some(c => c === "class-11" || c === "class-12")) allowedLevels.push("hsc");

          const levelAllowed = allowedLevels.includes(question.level);
          // domain.subjects stores English names; question.subject is Bengali
          let subjectAllowed = false;
          if (domain?.subjects && domain.subjects.length > 0) {
            const mapping = COURSE_TO_MCQ_SUBJECT_MAP[question.level as "ssc" | "hsc"] || {};
            subjectAllowed = domain.subjects.some((engSub) => {
              const bengaliNames = mapping[engSub];
              return Array.isArray(bengaliNames) && bengaliNames.includes(question.subject);
            });
            if (!subjectAllowed) subjectAllowed = domain.subjects.includes(question.subject);
          }
          if (levelAllowed && subjectAllowed) {
            allowed = true;
          }
        }

      if (!allowed) {
        return fail("Access denied to this question's subject/level", 403);
      }
    }

    report.resolved = true;
    await report.save();

    return success({
      message: "Report marked as resolved successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
