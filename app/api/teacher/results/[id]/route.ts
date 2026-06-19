import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { User } from "@/lib/db/models/User";
import { connectDB } from "@/lib/db/connect";

type Context = {
  params: Promise<{ id: string }>;
};

async function checkAuthorization(teacherId: string, studentId: string, subject: string) {
  const teacherDoc = await User.findById(teacherId).lean();
  if (!teacherDoc) {
    return { authorized: false, error: fail("Teacher not found", 404) };
  }

  const domain = teacherDoc.teacherDomain;

  let allowedClasses: string[] = [];
  if (domain?.isAll) {
    allowedClasses = ["class-9", "class-10", "class-11", "class-12"];
  } else if (domain?.classes && domain.classes.length > 0) {
    allowedClasses = domain.classes;
  } else {
    return { authorized: false, error: fail("You are not authorised to modify this result.", 403) };
  }

  // Check student assignment if not all access
  if (!domain?.isAll) {
    const assignedStudents = (domain?.students || []).map(String);
    if (!assignedStudents.includes(String(studentId))) {
      return { authorized: false, error: fail("You are not authorised to view/modify this student's results.", 403) };
    }
  }

  // Find the student's class
  const student = await User.findById(studentId).lean();
  if (!student) {
    return { authorized: false, error: fail("Student not found", 404) };
  }

  if (!allowedClasses.includes(student.studentClass || "")) {
    return { authorized: false, error: fail("You are not authorised to modify this result's class.", 403) };
  }

  let allowedSubjects: string[] | null = null;
  if (!domain?.isAll && domain?.subjects && domain.subjects.length > 0) {
    allowedSubjects = domain.subjects;
  }

  if (allowedSubjects && !allowedSubjects.includes(subject)) {
    return { authorized: false, error: fail("You are not authorised to modify this result's subject.", 403) };
  }

  return { authorized: true };
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher", "admin"]);
    const { id } = await context.params;

    const attempt = await PracticeAttempt.findById(id);
    if (!attempt) {
      return fail("Practice attempt not found", 404);
    }

    if (user.role === "teacher") {
      const auth = await checkAuthorization(user.id, attempt.student.toString(), attempt.subject);
      if (!auth.authorized) {
        return auth.error!;
      }
    }

    // Hard delete the specific attempt from the database
    await PracticeAttempt.findByIdAndDelete(id);

    // Hard delete the overall practice result for this student and subject
    await PracticeResult.deleteMany({
      student: attempt.student,
      subject: attempt.subject,
    });

    // Hard delete all other attempts of this student for this subject to wipe the history completely
    await PracticeAttempt.deleteMany({
      student: attempt.student,
      subject: attempt.subject,
    });

    return success({ message: "Result and all related database records deleted successfully from the system." });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["teacher", "admin"]);
    const { id } = await context.params;
    const { teacherComment } = await request.json();

    const attempt = await PracticeAttempt.findById(id);
    if (!attempt) {
      return fail("Practice attempt not found", 404);
    }

    if (user.role === "teacher") {
      const auth = await checkAuthorization(user.id, attempt.student.toString(), attempt.subject);
      if (!auth.authorized) {
        return auth.error!;
      }
    }

    attempt.teacherComment = teacherComment ?? "";
    attempt.commentedBy = user.id as any;
    await attempt.save();

    // Sync to PracticeResult (student dashboard summary)
    await PracticeResult.updateMany(
      { student: attempt.student, subject: attempt.subject },
      { 
        $set: { 
          teacherComment: teacherComment ?? "",
          commentedBy: user.id
        } 
      }
    );

    return success({ message: "Comment updated successfully.", attempt });
  } catch (error) {
    return handleApiError(error);
  }
}
