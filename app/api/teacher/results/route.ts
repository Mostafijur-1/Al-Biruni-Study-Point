import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { User } from "@/lib/db/models/User";
import { connectDB } from "@/lib/db/connect";
import { getSchoolLevel } from "@/lib/content/syllabus";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const teacher = await requireAuth(request, ["teacher"]);

    // Load full teacher document to get domain config
    const teacherDoc = await User.findById(teacher.id).lean();
    if (!teacherDoc) {
      return fail("Teacher not found", 404);
    }

    const domain = teacherDoc.teacherDomain;

    // Parse optional query filters from the request
    const { searchParams } = new URL(request.url);
    const filterClass = searchParams.get("class") ?? undefined;
    const filterSubject = searchParams.get("subject") ?? undefined;
    const filterStudent = searchParams.get("studentId") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    // Build the list of allowed student classes for this teacher
    let allowedClasses: string[] = [];
    if (domain?.isAll) {
      allowedClasses = ["class-9", "class-10", "class-11", "class-12"];
    } else if (domain?.classes && domain.classes.length > 0) {
      allowedClasses = domain.classes;
    } else {
      // Teacher has no domain assigned — return empty
      return success({ results: [], total: 0, page, limit });
    }

    // Apply optional class filter (must be within allowed classes)
    if (filterClass) {
      if (!allowedClasses.includes(filterClass)) {
        return fail("You are not authorised to view results for this class.", 403);
      }
      allowedClasses = [filterClass];
    }

    // Build the list of allowed subjects
    let allowedSubjects: string[] | null = null;
    if (!domain?.isAll && domain?.subjects && domain.subjects.length > 0) {
      allowedSubjects = domain.subjects;
    }

    if (filterSubject && allowedSubjects && !allowedSubjects.includes(filterSubject)) {
      return fail("You are not authorised to view results for this subject.", 403);
    }

    // Find students who belong to the allowed classes
    const studentQuery: Record<string, unknown> = {
      role: "student",
      studentClass: { $in: allowedClasses },
    };
    if (filterStudent) {
      studentQuery._id = filterStudent;
    }

    const students = await User.find(studentQuery, { _id: 1, name: 1, phone: 1, studentClass: 1 }).lean();
    const studentIds = students.map((s) => s._id);
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

    if (studentIds.length === 0) {
      return success({ results: [], total: 0, page, limit });
    }

    // Build attempt query
    const attemptQuery: Record<string, unknown> = {
      student: { $in: studentIds },
    };

    // Subject filter
    if (filterSubject) {
      attemptQuery.subject = filterSubject;
    } else if (allowedSubjects) {
      attemptQuery.subject = { $in: allowedSubjects };
    }

    const total = await PracticeAttempt.countDocuments(attemptQuery);

    const attempts = await PracticeAttempt.find(attemptQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Shape data for teacher view — include wrong answers only
    const results = attempts.map((attempt) => {
      const student = studentMap.get(attempt.student.toString());
      const wrongAnswers = attempt.answers.filter((a) => !a.isCorrect);

      return {
        id: attempt._id.toString(),
        student: {
          id: attempt.student.toString(),
          name: student?.name ?? "Unknown",
          phone: student?.phone ?? null,
          class: student?.studentClass ?? null,
          level: student?.studentClass ? getSchoolLevel(student.studentClass) : null,
        },
        subject: attempt.subject,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        timeTaken: attempt.timeTaken,
        submittedAt: attempt.createdAt,
        wrongAnswers: wrongAnswers.map((a) => ({
          question: a.question,
          options: a.options,
          selectedIndex: a.selectedIndex,
          correctIndex: a.correctIndex,
          explanation: a.explanation ?? null,
        })),
      };
    });

    const serializedDomain = domain
      ? {
          isAll: !!domain.isAll,
          classes: domain.classes || [],
          subjects: (domain.subjects || []).map((s: any) =>
            Array.isArray(s) ? String(s[0]) : String(s)
          ),
        }
      : { isAll: false, classes: [], subjects: [] };

    return success({ results, total, page, limit, domain: serializedDomain });
  } catch (error) {
    return handleApiError(error);
  }
}
