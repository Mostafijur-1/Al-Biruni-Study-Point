import { placeholderResponse } from "@/lib/api/placeholder";

export async function POST() {
  return placeholderResponse("Upload API placeholder.");
}
