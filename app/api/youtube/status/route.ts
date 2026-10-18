// Which YouTube channels are connected (no tokens exposed — titles and slots only).
import { NextResponse } from "next/server";
import { listConnections, youtubeEnabled } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const connections = youtubeEnabled() ? await listConnections() : {};
  return NextResponse.json({ configured: youtubeEnabled(), connections });
}
