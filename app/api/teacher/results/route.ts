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

    // Build attempt query
    const attemptQuery: Record<string, unknown> = {
      deletedByTeacher: { $ne: true }, // Filter out soft-deleted attempts
    };

    // Subject filter
    if (filterSubject) {
      attemptQuery.subject = filterSubject;
    } else if (allowedSubjects) {
      attemptQuery.subject = { $in: allowedSubjects };
    }

    // Check if student filtering is required
    const needsStudentFiltering = !domain?.isAll || filterClass || filterStudent;

    if (needsStudentFiltering) {
      const studentQuery: Record<string, unknown> = {
        role: "student",
        studentClass: { $in: allowedClasses },
      };
      if (filterStudent) {
        studentQuery._id = filterStudent;
      }
      const students = await User.find(studentQuery, { _id: 1 }).lean();
      const studentIds = students.map((s) => s._id);
      if (studentIds.length === 0) {
        return success({ results: [], total: 0, page, limit });
      }
      attemptQuery.student = { $in: studentIds };
    }

    const total = await PracticeAttempt.countDocuments(attemptQuery);

    const attempts = await PracticeAttempt.find(attemptQuery)
      .populate("student", "name phone studentClass schoolCollege")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Shape data for teacher view — include wrong answers only
    const results = attempts.map((attempt: any) => {
      const student = attempt.student;
      const wrongAnswers = attempt.answers.filter((a: any) => !a.isCorrect);

      return {
        id: attempt._id.toString(),
        student: {
          id: student?._id?.toString() ?? attempt.student?.toString() ?? "",
          name: student?.name ?? "Unknown",
          phone: student?.phone ?? null,
          class: student?.studentClass ?? null,
          level: student?.studentClass ? getSchoolLevel(student.studentClass) : null,
          schoolCollege: student?.schoolCollege ?? null,
        },
        subject: attempt.subject,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        timeTaken: attempt.timeTaken,
        submittedAt: attempt.createdAt,
        teacherComment: attempt.teacherComment ?? "",
        wrongAnswers: wrongAnswers.map((a: any) => ({
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
