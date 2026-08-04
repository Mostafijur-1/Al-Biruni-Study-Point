import assert from "node:assert/strict";
import test from "node:test";

import { redactGuestVideoUrl } from "../lib/content/video-visibility.ts";

test("guest video serialization never exposes the media URL", () => {
  const video = {
    _id: "video-1",
    title: "Motion class",
    videoUrl: "https://media.example/private-token",
  };
  assert.deepEqual(redactGuestVideoUrl("guest", video), {
    _id: "video-1",
    title: "Motion class",
  });
  const studentVideo = redactGuestVideoUrl("student", video);
  assert.equal("videoUrl" in studentVideo ? studentVideo.videoUrl : undefined, video.videoUrl);
});
