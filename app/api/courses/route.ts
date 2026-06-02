import { NextRequest } from "next/server";

import { classFilterForStudent } from "@/lib/content/classes";
import { applyGuestClassFilter } from "@/lib/content/guest-scope.server";
import { mapDocWithTargetClasses } from "@/lib/content/serialize";
import { requireStudentClass } from "@/lib/content/student-access";
import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Course } from "@/lib/db/models/Course";
import { createCourseSchema } from "@/lib/validations/course.schema";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const scope = searchParams.get("scope");
    const query: Record<string, unknown> = {};

    const guestError = applyGuestClassFilter(
      scope,
      searchParams.get("class"),
      query,
      "status",
    );

    if (guestError) {
      return guestError;
    }

    if (scope === "student") {
      const user = await requireAuth(request, ["student"]);
      const studentClass = requireStudentClass(user);

      query.status = "published";
      Object.assign(query, classFilterForStudent(studentClass));
    } else if (scope !== "guest") {
      const user = await requireAuth(request, ["admin", "teacher"]);

      if (user.role === "teacher") {
        query.teacher = user.id;
      }
    }

    const courses = await Course.find(query).sort({ createdAt: -1 }).limit(100).lean();

    return success({ courses: courses.map(mapDocWithTargetClasses) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "teacher"]);
    const parsed = createCourseSchema.parse(await request.json());

    await connectDB();

    const baseSlug = slugify(parsed.title);
    let slug = baseSlug;
    let suffix = 1;

    while (await Course.findOne({ slug })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const course = await Course.create({
      title: parsed.title,
      titleBn: parsed.titleBn,
      slug,
      description: parsed.description || undefined,
      level: parsed.level,
      subject: parsed.subject,
      targetClasses: parsed.targetClasses,
      teacher: user.id,
      status: parsed.isPublished ? "published" : "draft",
      price: 0,
      isFree: true,
      tags: [],
    });

    await Course.updateOne({ _id: course._id }, { $set: { targetClasses: parsed.targetClasses } });

    const saved = await Course.findById(course._id).lean();

    return success(
      { course: saved ? mapDocWithTargetClasses(saved) : mapDocWithTargetClasses(course.toObject()) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
