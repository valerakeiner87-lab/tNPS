import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const db = await checkDatabaseConnection();
  return NextResponse.json({
    name: "ATC Digital · Claro Guatemala",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    database: {
      configured: !!process.env.DATABASE_URL,
      connected: db.ok,
      error: db.error,
    },
  });
}
