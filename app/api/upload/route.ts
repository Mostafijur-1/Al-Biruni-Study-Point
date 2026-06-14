import { NextRequest } from "next/server";
import { fail, handleApiError, success } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/session";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user (must be teacher or admin)
    await requireAuth(request, ["teacher", "admin"]);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return fail("No file uploaded", 400);
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(buffer, "mcq-images");

    return success({
      url: uploadResult.url,
      publicId: uploadResult.publicId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
