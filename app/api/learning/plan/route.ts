import { NextRequest } from "next/server";

import { handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { classFilterForStudent } from "@/lib/content/classes";
import { requireStudentClass } from "@/lib/content/student-access";
import { connectDB } from "@/lib/db/connect";
import { MistakeReview } from "@/lib/db/models/MistakeReview";
import { Video } from "@/lib/db/models/Video";
import { VideoProgress } from "@/lib/db/models/VideoProgress";
import { backfillMistakesForStudent } from "@/lib/learning/mistake-service";
import { getStudentMastery } from "@/lib/learning/mastery-service";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await requireAuth(request, ["student"]);
    const studentClass = requireStudentClass(user);

    await backfillMistakesForStudent(user.id);
    const [mastery, dueMistakes, videos] = await Promise.all([
      getStudentMastery(user.id, studentClass),
      MistakeReview.countDocuments({
        student: user.id,
        status: "active",
        nextReviewAt: { $lte: new Date() },
      }),
      Video.find({
        isPublished: true,
        ...classFilterForStudent(studentClass),
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("title")
        .lean(),
    ]);

    const progress = await VideoProgress.find({
      student: user.id,
      video: { $in: videos.map((video) => video._id) },
    }).lean();
    const progressMap = new Map(
      progress.map((item) => [String(item.video), item]),
    );
    const nextVideo = videos.find(
      (video) => progressMap.get(String(video._id))?.status !== "completed",
    );
    const nextVideoProgress = nextVideo
      ? progressMap.get(String(nextVideo._id))
      : undefined;

    const tasks = [];
    if (dueMistakes > 0) {
      tasks.push({
        id: "mistake-review",
        type: "mistake_review",
        title: `${dueMistakes}টি ভুল আবার দেখো`,
        description: "আজ পুনরাবৃত্তির সময় হয়েছে—সঠিক উত্তর দিয়ে স্মৃতি শক্ত করো।",
        href: "/student/mistakes?due=1",
        estimatedMinutes: Math.min(20, Math.max(3, Math.ceil(dueMistakes * 0.75))),
      });
    } else {
      tasks.push({
        id: "mistake-notebook",
        type: "mistake_review",
        title: "ভুলের খাতা দেখে নাও",
        description: "আগের কঠিন প্রশ্নগুলো একবার ঝালিয়ে নাও।",
        href: "/student/mistakes",
        estimatedMinutes: 5,
      });
    }

    if (mastery.recommendation) {
      const recommendation = mastery.recommendation;
      tasks.push({
        id: "mastery-practice",
        type: "chapter_practice",
        title: `${recommendation.subject}: লক্ষ্যভিত্তিক অনুশীলন`,
        description: `${recommendation.chapter} অধ্যায়ে তোমার দক্ষতা ${recommendation.score}%।`,
        href: "/student/practice",
        estimatedMinutes: 10,
      });
    } else {
      tasks.push({
        id: "general-practice",
        type: "chapter_practice",
        title: "আজকের ১০ প্রশ্ন",
        description: "যেকোনো বিষয় বেছে নিয়ে নিয়মিত অনুশীলন ধরে রাখো।",
        href: "/student/practice",
        estimatedMinutes: 10,
      });
    }

    if (nextVideo) {
      tasks.push({
        id: "continue-video",
        type: "video",
        title: nextVideoProgress ? "ভিডিও ক্লাস চালিয়ে যাও" : "নতুন ভিডিও ক্লাস দেখো",
        description: nextVideo.title,
        href: `/student/courses/video/${nextVideo._id}`,
        estimatedMinutes: 15,
        progressPercent: nextVideoProgress?.progressPercent ?? 0,
      });
    }

    return success({
      tasks,
      dueMistakes,
      recommendation: mastery.recommendation,
      generatedAt: new Date(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
