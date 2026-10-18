// Starts the YouTube OAuth flow for one channel.
// Usage: /api/youtube/connect?channel=avatails  (or wildtails)
// Log into the matching Google/YouTube account BEFORE opening this URL.
import { NextRequest, NextResponse } from "next/server";
import { consentUrl, youtubeEnabled } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!youtubeEnabled()) {
    return NextResponse.json(
      { error: "YouTube is not configured — set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and Blob storage." },
      { status: 400 }
    );
  }
  const channel = req.nextUrl.searchParams.get("channel") || "";
  if (channel !== "avatails" && channel !== "wildtails") {
    return NextResponse.json({ error: "channel must be avatails or wildtails" }, { status: 400 });
  }
  const redirectUri = `${req.nextUrl.origin}/api/youtube/callback`;
  return NextResponse.redirect(consentUrl(channel, redirectUri));
}
