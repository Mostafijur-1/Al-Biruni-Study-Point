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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const hasMongoUri = Boolean(process.env.MONGODB_URI);
    const hasJwtAccess = Boolean(process.env.JWT_ACCESS_SECRET);
    const hasJwtRefresh = Boolean(process.env.JWT_REFRESH_SECRET);

    return NextResponse.json(
      {
        status: "unavailable",
        error: message,
        envCheck: {
          MONGODB_URI: hasMongoUri ? "configured" : "MISSING",
          JWT_ACCESS_SECRET: hasJwtAccess ? "configured" : "MISSING",
          JWT_REFRESH_SECRET: hasJwtRefresh ? "configured" : "MISSING",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

