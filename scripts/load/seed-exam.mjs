/**
 * Seed an isolated exam and synthetic students for load testing.
 *
 * Required environment variables:
 *   MONGODB_URI
 *   JWT_ACCESS_SECRET (at least 32 characters)
 *
 * Optional:
 *   LOAD_TEST_STUDENTS=500
 *   LOAD_TEST_QUESTIONS=25
 *   LOAD_TEST_FIXTURE=scripts/load/fixture.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

if (process.env.ALLOW_LOAD_TEST_SEED !== "true") {
  throw new Error(
    "Refusing to seed synthetic users. Set ALLOW_LOAD_TEST_SEED=true after confirming MONGODB_URI points to a test database.",
  );
}

const studentCount = boundedInteger("LOAD_TEST_STUDENTS", 500, 1, 10_000);
const questionCount = boundedInteger("LOAD_TEST_QUESTIONS", 25, 1, 200);
const fixturePath = path.resolve(
  process.env.LOAD_TEST_FIXTURE || "scripts/load/fixture.json",
);
const mongoUri = required("MONGODB_URI");
const jwtSecret = required("JWT_ACCESS_SECRET");

if (jwtSecret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must contain at least 32 characters.");
}

const prefix = "absp-loadtest";
const teacherEmail = `${prefix}-teacher@example.invalid`;
const examTitle = "[LOAD TEST] Concurrent MCQ Exam";

await mongoose.connect(mongoUri, { bufferCommands: false, dbName: "absp" });

try {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection did not provide a database.");

  const users = db.collection("users");
  const exams = db.collection("mcqexams");
  const questions = db.collection("mcqquestions");
  const attempts = db.collection("mcqexamattempts");
  const now = new Date();
  const password = await bcrypt.hash(`${prefix}-password`, 12);

  const teacherResult = await users.findOneAndUpdate(
    { email: teacherEmail },
    {
      $set: {
        name: "ABSP Load Test Teacher",
        email: teacherEmail,
        password,
        role: "teacher",
        isActive: true,
        approvalStatus: "approved",
        teacherDomain: {
          isAll: true,
          classes: ["class-9"],
          subjects: ["Physics"],
          students: [],
        },
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  const teacher = teacherResult;
  if (!teacher?._id) throw new Error("Could not create the load-test teacher.");

  const studentEmails = Array.from(
    { length: studentCount },
    (_, index) => `${prefix}-student-${String(index + 1).padStart(5, "0")}@example.invalid`,
  );

  await users.bulkWrite(
    studentEmails.map((email, index) => ({
      updateOne: {
        filter: { email },
        update: {
          $set: {
            name: `ABSP Load Test Student ${index + 1}`,
            email,
            password,
            role: "student",
            studentClass: "class-9",
            isActive: true,
            approvalStatus: "approved",
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  const seededStudents = await users
    .find({ email: { $in: studentEmails } }, { projection: { _id: 1, email: 1 } })
    .sort({ email: 1 })
    .toArray();

  if (seededStudents.length !== studentCount) {
    throw new Error(`Expected ${studentCount} students, found ${seededStudents.length}.`);
  }

  const exam = await exams.findOneAndUpdate(
    { title: examTitle, teacher: teacher._id },
    {
      $set: {
        title: examTitle,
        teacher: teacher._id,
        subject: "Physics",
        duration: 30,
        totalMarks: questionCount,
        passMark: Math.ceil(questionCount * 0.4),
        targetClasses: ["class-9"],
        isPublished: true,
        resultsPublished: false,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!exam?._id) throw new Error("Could not create the load-test exam.");

  // Reset only the synthetic exam. This makes repeated load-test runs deterministic.
  await attempts.deleteMany({ exam: exam._id, student: { $in: seededStudents.map((s) => s._id) } });
  await questions.deleteMany({ exam: exam._id });
  await questions.insertMany(
    Array.from({ length: questionCount }, (_, index) => ({
      exam: exam._id,
      question: `Load-test question ${index + 1}`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: index % 4,
      explanation: "Synthetic load-test content.",
      marks: 1,
      difficulty: "medium",
      topic: "Load testing",
      order: index,
      createdAt: now,
      updatedAt: now,
    })),
  );

  const fixture = {
    generatedAt: now.toISOString(),
    examId: String(exam._id),
    questionCount,
    students: seededStudents.map((student) => ({
      id: String(student._id),
      token: jwt.sign(
        { userId: String(student._id), role: "student", email: student.email },
        jwtSecret,
        { algorithm: "HS256", expiresIn: "2h" },
      ),
    })),
  };

  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, { mode: 0o600 });

  console.log(`Seeded ${studentCount} synthetic students.`);
  console.log(`Seeded exam ${fixture.examId} with ${questionCount} questions.`);
  console.log(`Wrote short-lived access tokens to ${fixturePath}.`);
} finally {
  await mongoose.disconnect();
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function boundedInteger(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}
