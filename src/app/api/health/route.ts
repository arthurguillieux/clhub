import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/core/db/client";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json({ status: "error", database: "down" }, { status: 503 });
  }
}
