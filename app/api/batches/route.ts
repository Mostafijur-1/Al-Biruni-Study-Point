import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Batches API placeholder." }, { status: 501 });
}
