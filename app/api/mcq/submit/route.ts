import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "MCQ submit API placeholder." }, { status: 501 });
}
