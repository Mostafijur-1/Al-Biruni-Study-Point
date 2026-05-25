import { placeholderResponse } from "@/lib/api/placeholder";

export async function GET() {
  return placeholderResponse("Videos API placeholder.");
}
