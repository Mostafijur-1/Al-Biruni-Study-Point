import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { validateImageFile } from "@/lib/image-validation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_IMAGE_UPLOADS = 3;

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user (must be teacher or admin)
    const user = await requireAuth(request, ["teacher", "admin"]);
    const rateLimit = await consumeRateLimit("upload:image", user.id, {
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const legacyFile = formData.get("file");
    if (legacyFile instanceof File && legacyFile.size > 0 && files.length === 0) {
      files.push(legacyFile);
    }
    if (files.length === 0) {
      return fail("No file uploaded", 400);
    }
    if (files.length > MAX_IMAGE_UPLOADS) {
      return fail(`You can upload a maximum of ${MAX_IMAGE_UPLOADS} images at a time.`, 400);
    }

    for (const file of files) {
      const validation = await validateImageFile(file);
      if (!validation.ok) {
        return fail(validation.error, validation.status);
      }
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return uploadToCloudinary(buffer, "mcq-images");
      }),
    );

    return success({
      url: uploads[0].url,
      publicId: uploads[0].publicId,
      uploads,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
