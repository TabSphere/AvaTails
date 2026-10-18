// OAuth landing page — Google sends the user back here with ?code&state=channel.
// Stores the refresh token, then returns to the dashboard Settings tab.
import { NextRequest, NextResponse } from "next/server";
import { completeOAuth } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const channel = req.nextUrl.searchParams.get("state") || "";
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${req.nextUrl.origin}/?tab=settings&yt=error:${oauthError}`);
  }
  if (!code || (channel !== "avatails" && channel !== "wildtails")) {
    return NextResponse.json({ error: "Missing code or invalid channel state" }, { status: 400 });
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/youtube/callback`;
    const conn = await completeOAuth(channel, code, redirectUri);
    const label = encodeURIComponent(conn.channelTitle || channel);
    return NextResponse.redirect(`${req.nextUrl.origin}/?tab=settings&yt=connected:${channel}:${label}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(`${req.nextUrl.origin}/?tab=settings&yt=error:${encodeURIComponent(msg.slice(0, 120))}`);
  }
}
