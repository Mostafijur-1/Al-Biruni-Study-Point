import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db/connect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const connection = await connectDB();
    const database = connection.connection.db;
    if (!database) {
      throw new Error("Database connection is unavailable.");
    }
    await database.admin().ping();

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
