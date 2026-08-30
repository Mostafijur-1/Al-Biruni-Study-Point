import assert from "node:assert/strict";
import mongoose from "mongoose";

import { applyCanonicalScopeBackfill, inspectCanonicalScopeBackfill } from "../lib/db/canonical-scope-backfill.ts";

const uri = process.env.ACADEMIC_TEST_MONGODB_URI?.trim();
const dbName = process.env.ACADEMIC_TEST_DB_NAME?.trim();
if (!uri) throw new Error("ACADEMIC_TEST_MONGODB_URI is required.");
if (!dbName || !/^absp_[a-z0-9_-]*test$/i.test(dbName) || dbName.toLowerCase() === "absp") {
  throw new Error("ACADEMIC_TEST_DB_NAME must be an explicit absp_*test database.");
}

const connection = mongoose.createConnection(uri, { autoIndex: false, dbName });
await connection.asPromise();
const database = connection.db;
if (!database) throw new Error("MongoDB connection has no database handle.");

try {
  const organizationId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const academicSessionId = new mongoose.Types.ObjectId();
  const subjectId = new mongoose.Types.ObjectId();
  const chapterId = new mongoose.Types.ObjectId();
  const batchId = new mongoose.Types.ObjectId();
  const examId = new mongoose.Types.ObjectId();
  await database.collection("academicsubjects").insertOne({
    _id: subjectId, organizationId, code: "PHY", name: "Physics", nameBn: "Physics BN", aliases: ["পদার্থ"], status: "active",
  });
  await database.collection("academicchapters").insertOne({
    _id: chapterId, organizationId, subjectId, code: "MOTION", name: "Motion", nameBn: "Motion BN", status: "active",
  });
  await database.collection("batches").insertOne({ _id: batchId, organizationId, branchId, academicSessionId });
  const course = await database.collection("courses").insertOne({ subject: " physics " });
  const practice = await database.collection("practicequestions").insertOne({ subject: "PHY", chapter: "motion" });
  const written = await database.collection("writtenexams").insertOne({ batchId, subjectId });
  await database.collection("mcqexams").insertOne({ _id: examId, organizationId, subjectId });
  const question = await database.collection("mcqquestions").insertOne({ exam: examId });
  const exception = await database.collection("videos").insertOne({ subject: "Unknown" });

  const inspected = await inspectCanonicalScopeBackfill(database, 100);
  assert.equal(inspected.report.plannedTotal, 4);
  assert.equal(inspected.report.exceptionCount, 1);
  assert.equal(inspected.report.exceptions[0]?.collection, "videos");
  assert.notEqual(inspected.report.exceptions[0]?.ref, String(exception.insertedId));

  await applyCanonicalScopeBackfill(database, 100);
  assert.equal(String((await database.collection("courses").findOne({ _id: course.insertedId }))?.subjectId), String(subjectId));
  assert.equal(String((await database.collection("practicequestions").findOne({ _id: practice.insertedId }))?.chapterId), String(chapterId));
  assert.equal(String((await database.collection("writtenexams").findOne({ _id: written.insertedId }))?.branchId), String(branchId));
  assert.equal(String((await database.collection("mcqquestions").findOne({ _id: question.insertedId }))?.organizationId), String(organizationId));

  console.log(JSON.stringify({ status: "passed", database: dbName, scenarios: ["alias", "chapter", "batch", "exam", "exception"] }, null, 2));
} finally {
  await database.dropDatabase();
  await connection.close();
}
