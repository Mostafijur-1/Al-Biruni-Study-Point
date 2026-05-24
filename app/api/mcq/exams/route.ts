import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "MCQ exams API placeholder." }, { status: 501 });
}
