import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    service: "ai-portfolio-factory",
    time: new Date().toISOString()
  });
}
