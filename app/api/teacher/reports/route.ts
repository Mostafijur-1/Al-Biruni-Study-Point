import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { ReportedQuestion } from "@/lib/db/models/ReportedQuestion";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { COURSE_TO_MCQ_SUBJECT_MAP } from "@/lib/content/syllabus";

// Prevent tree-shaking of PracticeQuestion model
const _ = PracticeQuestion;

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
        path: "questionId",
        model: "PracticeQuestion"
      })
      .populate({
        path: "studentId",
        model: "User",
        select: "name email"
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter reports to match teacher's domain classes and subjects
    const filteredReports = reports.filter((report: any) => {
      const q = report.questionId;
      if (!q) return false;

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

    const report = await ReportedQuestion.findById(parsed.reportId).populate({
      path: "questionId",
      model: "PracticeQuestion",
    });
    if (!report) {
      return fail("Report not found", 404);
    }

    const question = report.questionId as any;
    if (question) {
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
