import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Videos API placeholder." }, { status: 501 });
}
