import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "CQ assignments API placeholder." }, { status: 501 });
}
