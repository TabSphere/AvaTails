// Telegram webhook — receives the Approve/Reject button taps from the
// review messages and runs them through the same approval gate as the dashboard.
import { NextRequest, NextResponse } from "next/server";
import { decideJob } from "@/lib/approval";
import { answerCallbackQuery, closeOutMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TgCallbackQuery {
  id: string;
  data?: string;
  from?: { first_name?: string; username?: string };
  message?: { chat?: { id?: number }; message_id?: number; text?: string; caption?: string };
}

export async function POST(req: NextRequest) {
  // Telegram signs every webhook call with this header when secret_token is set.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { callback_query?: TgCallbackQuery };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const cq = body.callback_query;
  if (!cq?.data) return NextResponse.json({ ok: true });

  const [action, jobId] = cq.data.split(":");
  if ((action !== "approve" && action !== "reject") || !jobId) {
    await answerCallbackQuery(cq.id, "Unknown action");
    return NextResponse.json({ ok: true });
  }

  const who = cq.from?.first_name || cq.from?.username || "Telegram";
  const result = await decideJob(jobId, action, undefined, who);

  if (!result.ok) {
    await answerCallbackQuery(cq.id, result.error || "Could not decide");
    return NextResponse.json({ ok: true });
  }

  const verdict =
    action === "approve"
      ? `APPROVED by ${who} — "${result.jobTitle}" shipped.`
      : `REJECTED by ${who} — "${result.jobTitle}" marked failed.`;
  await answerCallbackQuery(cq.id, action === "approve" ? "Approved" : "Rejected");

  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (chatId != null && messageId != null) {
    const original = cq.message?.caption || cq.message?.text || "";
    await closeOutMessage(chatId, messageId, `${original}\n\n— ${verdict}`);
  }
  return NextResponse.json({ ok: true });
}

// Telegram (and humans checking the URL) get a friendly answer on GET.
export async function GET() {
  return NextResponse.json({ ok: true, service: "avatails-telegram-webhook" });
}
