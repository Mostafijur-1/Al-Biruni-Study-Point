import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Courses API placeholder." }, { status: 501 });
}
