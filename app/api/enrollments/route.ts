import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Enrollments API placeholder." }, { status: 501 });
}
