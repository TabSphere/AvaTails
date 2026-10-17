import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/** Simple password gate. Active only when FACTORY_PASSWORD is set. */
export async function POST(req: NextRequest) {
  const password = process.env.FACTORY_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });

  const { password: attempt } = (await req.json()) as { password?: string };
  if (attempt !== password) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("avatails_auth", btoa(password), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
