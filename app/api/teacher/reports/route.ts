import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { ReportedQuestion } from "@/lib/db/models/ReportedQuestion";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";

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
      const subjectAllowed = domain?.subjects?.includes(q.subject);
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
    await requireAuth(request, ["teacher"]);

    const body = await request.json();
    const parsed = resolveReportSchema.parse(body);

    const report = await ReportedQuestion.findById(parsed.reportId);
    if (!report) {
      return fail("Report not found", 404);
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
