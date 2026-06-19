import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { requireStudentClass } from "@/lib/content/student-access";
import { fail, handleApiError, success } from "@/lib/api/response";
import { getPracticeSettings } from "@/lib/db/models/PracticeSettings";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { User } from "@/lib/db/models/User";
import { getSchoolLevel, SYLLABUS } from "@/lib/content/syllabus";
import type { CourseSubject } from "@/types";

/** Subjects shown for SSC students */
const SSC_SUBJECTS: CourseSubject[] = ["Physics", "Chemistry", "Math", "Higher Math", "ICT"];

/**
 * Subjects shown for HSC students.
 * Physics, Chemistry and Higher Math are split into 1st and 2nd paper.
 */
const HSC_SUBJECTS: CourseSubject[] = [
  "Physics 1st Paper",
  "Physics 2nd Paper",
  "Chemistry 1st Paper",
  "Chemistry 2nd Paper",
  "Higher Math 1st Paper",
  "Higher Math 2nd Paper",
  "ICT",
];

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const scope = searchParams.get("scope");
    const level = searchParams.get("level") === "HSC" ? "HSC" : "SSC";
    const mode = searchParams.get("mode") === "teacher" ? "teacher" : "general";

    let studentClass = "class-9";
    let userId: string | null = null;

    if (scope === "guest") {
      studentClass = level === "HSC" ? "class-11" : "class-9";
    } else {
      const user = await requireAuth(request, ["student"]);
      studentClass = requireStudentClass(user);
      userId = user.id;
    }

    const subjectParam = searchParams.get("subject");

    // Pick subject list based on level
    const isHsc = studentClass === "class-11" || studentClass === "class-12";
    const SUBJECTS = isHsc ? HSC_SUBJECTS : SSC_SUBJECTS;

    const levelKey = getSchoolLevel(studentClass);

    const targetSubjects = (subjectParam
      ? [subjectParam]
      : SUBJECTS) as CourseSubject[];

    // Fetch assigned teachers for the student if in teacher mode
    let assignedTeachers: any[] = [];
    if (userId && mode === "teacher") {
      const studentIdObj = new mongoose.Types.ObjectId(userId);
      assignedTeachers = await User.find({
        role: "teacher",
        $or: [
          { "teacherDomain.students": studentIdObj },
          { "teacherDomain.isAll": true }
        ]
      }).lean();
    }

    // Fetch student's practice results for target subjects (only if authenticated)
    let resultsQuery: any = { student: userId, subject: { $in: targetSubjects } };
    if (mode === "teacher") {
      resultsQuery.isTeacherSet = true;
    } else {
      resultsQuery.isTeacherSet = { $ne: true };
    }

    const results = userId ? await PracticeResult.find(resultsQuery).lean() : [];
    const resultsMap = new Map(results.map((r) => [r.subject, r]));

    // Batch query active questions for this level and target subjects
    const activeQuestionsQuery: any = {
      level: levelKey,
      subject: { $in: targetSubjects },
    };

    if (mode === "teacher") {
      const teacherIds = assignedTeachers.map((t) => t._id);
      activeQuestionsQuery.isTeacherSet = true;
      activeQuestionsQuery.createdBy = { $in: teacherIds };
    } else {
      activeQuestionsQuery.isTeacherSet = { $ne: true };
    }

    const activeQuestions = await PracticeQuestion.find(activeQuestionsQuery)
      .select("subject chapter")
      .lean();

    const populatedSet = new Set(
      activeQuestions.map((q) => `${q.subject}_${q.chapter}`)
    );

    const statusList = [];

    for (const subject of targetSubjects) {
      const syllabusChapters = SYLLABUS[levelKey]?.[subject] || [];
      const chapters = syllabusChapters.map((ch: string) => ({
        name: ch,
        hasMcqs: populatedSet.has(`${subject}_${ch}`),
      }));

      // If there are no chapters at all in syllabus, continue
      if (chapters.length === 0) continue;

      const lastResult = resultsMap.get(subject) || null;

      // Find the teacher assigned for this subject
      const teacherForSubject = assignedTeachers.find(
        (t) => t.teacherDomain?.isAll || t.teacherDomain?.subjects?.includes(subject)
      );

      statusList.push({
        subject,
        chapters,
        lastResult,
        teacherName: teacherForSubject ? teacherForSubject.name : null,
      });
    }
    const settings = await getPracticeSettings();
    return success({
      status: statusList,
      settings: {
        secondsPerQuestion: settings.secondsPerQuestion,
        passMarkPercent: settings.passMarkPercent,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
