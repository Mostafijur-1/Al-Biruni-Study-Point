import { NextResponse } from "next/server";

export function placeholderResponse(message: string) {
  return NextResponse.json({ message }, { status: 501 });
}
