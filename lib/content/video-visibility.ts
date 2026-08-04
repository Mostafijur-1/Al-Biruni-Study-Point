export function redactGuestVideoUrl<T extends Record<string, unknown>>(
  scope: string | null,
  video: T,
): T | Omit<T, "videoUrl"> {
  if (scope !== "guest") return video;
  const { videoUrl, ...safeVideo } = video;
  void videoUrl;
  return safeVideo;
}
