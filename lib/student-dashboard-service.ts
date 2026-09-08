import mongoose from "mongoose";

import type { StudentClass } from "@/types";
import { classFilterForStudent } from "@/lib/content/classes";
import {
  BENGALI_TO_ENGLISH_SUBJECT_MAP,
  getSchoolLevel,
  getSyllabusChapters,
  HSC_MCQ_SUBJECTS,
  SSC_MCQ_SUBJECTS,
} from "@/lib/content/syllabus";
import { CqAssignment } from "@/lib/db/models/CqAssignment";
import { McqExam } from "@/lib/db/models/McqExam";
import { McqExamAttempt } from "@/lib/db/models/McqExamAttempt";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { PracticeResult } from "@/lib/db/models/PracticeResult";
import { StudentGameProfile } from "@/lib/db/models/StudentGameProfile";
import { User } from "@/lib/db/models/User";
import { Video } from "@/lib/db/models/Video";
import { getOrCreateGameProfile } from "@/lib/gamification/service";
import { visibleStreak } from "@/lib/gamification/engagement-rules";
import { getDhakaDateKey } from "@/lib/gamification/rules";

export async function loadStudentDashboard(
  studentId: string,
  studentClass: StudentClass,
) {
  const studentObjectId = new mongoose.Types.ObjectId(studentId);

  const [game, subjects, teacherIds, assignments, videos] = await Promise.all([
    loadGameProfile(studentId),
    loadPracticeSubjects(studentObjectId, studentClass),
    loadTeacherIds(studentObjectId),
    loadAssignments(studentClass),
    loadLatestVideo(studentClass),
  ]);

  const exams = await loadExams(studentObjectId, studentClass, teacherIds);

  return { game, subjects, exams, assignments, videos };
}

async function loadGameProfile(studentId: string) {
  const profile = await StudentGameProfile.findOne({ student: studentId }).lean()
    ?? await getOrCreateGameProfile(studentId);
  const today = getDhakaDateKey();
  const currentStreak = visibleStreak({
    currentStreak: profile.currentStreak,
    lastQualifiedDate: profile.lastQualifiedDate,
    currentDateKey: today,
    streakFreezes: profile.streakFreezes,
  });

  return {
    profile: {
      totalXp: profile.totalXp,
      level: profile.level,
      currentStreak,
      longestStreak: profile.longestStreak,
      dailyProgress: profile.dailyProgressDate === today ? profile.dailyProgress : 0,
      dailyGoalTarget: profile.dailyGoalTarget,
      testsCompleted: profile.testsCompleted,
      totalQuestionsAnswered: profile.totalQuestionsAnswered,
      totalCorrect: profile.totalCorrect,
    },
  };
}

async function loadPracticeSubjects(
  studentId: mongoose.Types.ObjectId,
  studentClass: StudentClass,
) {
  const level = getSchoolLevel(studentClass);
  const targetSubjects = level === "hsc" ? HSC_MCQ_SUBJECTS : SSC_MCQ_SUBJECTS;
  const querySubjects = targetSubjects.flatMap((subject) => {
    const alias = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject];
    return alias ? [subject, alias] : [subject];
  });

  const [activeGroups, recentResults] = await Promise.all([
    PracticeQuestion.aggregate<{ subject: string; chapter: string }>([
      {
        $match: {
          level,
          subject: { $in: querySubjects },
          isTeacherSet: { $ne: true },
        },
      },
      { $group: { _id: { subject: "$subject", chapter: "$chapter" } } },
      { $project: { _id: 0, subject: "$_id.subject", chapter: "$_id.chapter" } },
    ]),
    PracticeResult.aggregate<{
      subject: string;
      percentage: number;
      submittedAt: Date;
    }>([
      {
        $match: {
          student: studentId,
          subject: { $in: targetSubjects },
          isTeacherSet: { $ne: true },
        },
      },
      { $sort: { submittedAt: -1 } },
      {
        $group: {
          _id: "$subject",
          percentage: { $first: "$percentage" },
          submittedAt: { $first: "$submittedAt" },
        },
      },
      {
        $project: {
          _id: 0,
          subject: "$_id",
          percentage: 1,
          submittedAt: 1,
        },
      },
    ]),
  ]);

  const populated = new Set(activeGroups.map((row) => `${row.subject}_${row.chapter}`));
  const results = new Map(recentResults.map((row) => [row.subject, row]));

  return targetSubjects.flatMap((subject) => {
    const alias = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;
    let chapters = getSyllabusChapters(level, subject);
    if (chapters.length === 0) {
      chapters = activeGroups
        .filter((row) => row.subject === subject || row.subject === alias)
        .map((row) => row.chapter);
    }
    if (chapters.length === 0) return [];

    const lastResult = results.get(subject);
    return [{
      subject,
      chapters: chapters.map((name) => ({
        name,
        hasMcqs: populated.has(`${subject}_${name}`) || populated.has(`${alias}_${name}`),
      })),
      lastResult: lastResult
        ? { percentage: lastResult.percentage, submittedAt: lastResult.submittedAt }
        : null,
    }];
  });
}

async function loadTeacherIds(studentId: mongoose.Types.ObjectId) {
  const teachers = await User.find({
    role: "teacher",
    $or: [
      { "teacherDomain.students": studentId },
      { "teacherDomain.isAll": true },
    ],
  })
    .select("_id")
    .lean();
  return teachers.map((teacher) => teacher._id);
}

async function loadExams(
  studentId: mongoose.Types.ObjectId,
  studentClass: StudentClass,
  teacherIds: mongoose.Types.ObjectId[],
) {
  if (teacherIds.length === 0) return [];

  const exams = await McqExam.find({
    teacher: { $in: teacherIds },
    isPublished: true,
    isArchived: { $ne: true },
    targetClasses: studentClass,
  })
    .select("title subject createdAt")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  if (exams.length === 0) return [];

  const attemptedExamIds = new Set(
    (await McqExamAttempt.distinct("exam", {
      student: studentId,
      exam: { $in: exams.map((exam) => exam._id) },
    })).map(String),
  );

  return exams.map((exam) => ({
    _id: String(exam._id),
    title: exam.title,
    subject: exam.subject,
    createdAt: exam.createdAt,
    hasSubmitted: attemptedExamIds.has(String(exam._id)),
  }));
}

async function loadAssignments(studentClass: StudentClass) {
  return CqAssignment.find({
    isPublished: true,
    ...classFilterForStudent(studentClass),
  })
    .select("title dueDate")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}

async function loadLatestVideo(studentClass: StudentClass) {
  return Video.find({
    isPublished: true,
    ...classFilterForStudent(studentClass),
  })
    .select("title description")
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();
}
