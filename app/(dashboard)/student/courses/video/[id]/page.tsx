import type { Metadata } from "next";

import { VideoLessonPlayer } from "@/components/learning/VideoLessonPlayer";

export const metadata: Metadata = {
  title: "ভিডিও ক্লাস | ABSP",
  description: "ভিডিও ক্লাস দেখো এবং শেখার অগ্রগতি সংরক্ষণ করো।",
};

type Props = { params: Promise<{ id: string }> };

export default async function StudentVideoLessonPage({ params }: Props) {
  const { id } = await params;
  return <VideoLessonPlayer videoId={id} />;
}
