// Telegram review gate — every finished episode lands in your Telegram
// with Approve / Reject buttons before anything counts as done.
//
// Setup (one time):
//   1. In Telegram, message @BotFather -> /newbot -> copy the bot token.
//   2. Message your new bot once, then open:
//      https://api.telegram.org/bot<TOKEN>/getUpdates  -> find chat.id
//   3. Vercel env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//      and TELEGRAM_WEBHOOK_SECRET (any random string).
//   4. Register the webhook:
//      https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://avatails.vercel.app/api/telegram/webhook&secret_token=<SECRET>

const botApi = (): string => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export const telegramEnabled = (): boolean =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

interface TelegramCall {
  method: string;
  body: Record<string, unknown>;
}

async function tg({ method, body }: TelegramCall): Promise<boolean> {
  try {
    const res = await fetch(`${botApi()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ApprovalNotice {
  jobId: string;
  title: string;
  channel: string;
  videoUrl?: string;
  costUSD?: number;
}

/** Sends the finished episode to the boss's Telegram with decision buttons. */
export async function notifyWaitingForApproval(n: ApprovalNotice): Promise<void> {
  if (!telegramEnabled()) return;
  const chatId = process.env.TELEGRAM_CHAT_ID as string;
  const brand = n.channel === "wildtails" ? "WildTails" : "AvaTails";
  const caption =
    `REVIEW NEEDED — ${brand}\n\n${n.title}\n` +
    (n.costUSD != null ? `Est. cost: $${n.costUSD.toFixed(3)}\n` : "") +
    `\nApprove to ship it, or reject to send it back.`;
  const reply_markup = {
    inline_keyboard: [
      [
        { text: "Approve", callback_data: `approve:${n.jobId}` },
        { text: "Reject", callback_data: `reject:${n.jobId}` },
      ],
    ],
  };

  // Prefer the playable video (Telegram fetches the public blob URL itself,
  // ~20 MB limit — our episodes are ~2 MB). Fall back to a text link.
  if (n.videoUrl) {
    const ok = await tg({
      method: "sendVideo",
      body: { chat_id: chatId, video: n.videoUrl, caption, reply_markup, supports_streaming: true },
    });
    if (ok) return;
  }
  await tg({
    method: "sendMessage",
    body: {
      chat_id: chatId,
      text: n.videoUrl ? `${caption}\n\n${n.videoUrl}` : caption,
      reply_markup,
      disable_web_page_preview: false,
    },
  });
}

/** Acknowledges a button tap (stops the loading spinner on the client). */
export async function answerCallbackQuery(id: string, text: string): Promise<void> {
  await tg({ method: "answerCallbackQuery", body: { callback_query_id: id, text } });
}

/** Replaces the buttons with the decision so nobody double-clicks. */
export async function closeOutMessage(chatId: number | string, messageId: number, text: string): Promise<void> {
  await tg({
    method: "editMessageText",
    body: { chat_id: chatId, message_id: messageId, text },
  });
}
