import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Register endpoint will be implemented in Module 3." },
    { status: 501 },
  );
}
