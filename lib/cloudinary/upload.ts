import { v2 as cloudinary } from "cloudinary";
import { getRequiredEnv } from "@/lib/env";

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
};

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string = "mcq-images"
): Promise<CloudinaryUploadResult> {
  cloudinary.config({
    cloud_name: getRequiredEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: getRequiredEnv("CLOUDINARY_API_KEY"),
    api_secret: getRequiredEnv("CLOUDINARY_API_SECRET"),
  });

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("No upload result from Cloudinary."));
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      )
      .end(fileBuffer);
  });
}
