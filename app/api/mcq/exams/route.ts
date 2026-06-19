import { NextRequest } from "next/server";

import mongoose from "mongoose";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqQuestion } from "@/lib/db/models/McqQuestion";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { User } from "@/lib/db/models/User";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);

    const studentClass = user.studentClass || "class-9";

    // 1. Find all teachers assigned to this student
    const studentIdObj = new mongoose.Types.ObjectId(user.id);
    const teachers = await User.find({
      role: "teacher",
      $or: [
        { "teacherDomain.students": studentIdObj },
        { "teacherDomain.isAll": true }
      ]
    }).lean();

    if (teachers.length === 0) {
      return success({ exams: [] });
    }

    const teacherIds = teachers.map((t) => t._id);

    // 2. Fetch all published exams for this student's class set by their teachers
    const exams = await McqExam.find({
      teacher: { $in: teacherIds },
      isPublished: true,
      targetClasses: studentClass,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (exams.length === 0) {
      return success({ exams: [] });
    }

    const examIds = exams.map((e) => e._id);

    // 3. Find if student has already submitted attempts for these exams
    const attempts = await McqExamAttempt.find({
      student: user.id,
      exam: { $in: examIds },
    }).lean();

    const attemptedExamIds = new Set(attempts.map((a) => String(a.exam)));

    // 4. Count questions for each exam
    const questionCounts = await McqQuestion.aggregate([
      { $match: { exam: { $in: examIds } } },
      { $group: { _id: "$exam", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(questionCounts.map((qc) => [String(qc._id), qc.count]));

    const formattedExams = exams.map((e) => {
      const teacher = teachers.find((t) => String(t._id) === String(e.teacher));
      return {
        ...e,
        questionCount: countMap.get(String(e._id)) || 0,
        hasSubmitted: attemptedExamIds.has(String(e._id)),
        teacherName: teacher ? teacher.name : "Teacher",
      };
    });

    return success({ exams: formattedExams });
  } catch (error) {
    return handleApiError(error);
  }
}
