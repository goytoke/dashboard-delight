const KEY = "bot-tracker-telegram";

export type TelegramConfig = { token: string; chatId: string };

export function loadTelegramConfig(): TelegramConfig {
  if (typeof window === "undefined") return { token: "", chatId: "" };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { token: "", chatId: "" };
    const parsed = JSON.parse(raw) as Partial<TelegramConfig>;
    return { token: parsed.token ?? "", chatId: parsed.chatId ?? "" };
  } catch {
    return { token: "", chatId: "" };
  }
}

export function saveTelegramConfig(cfg: TelegramConfig) {
  window.localStorage.setItem(KEY, JSON.stringify(cfg));
}

export async function sendTelegramMessage(cfg: TelegramConfig, text: string) {
  if (!cfg.token || !cfg.chatId) throw new Error("Configure the Telegram bot token and chat ID first");
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 3800) chunks.push(text.slice(i, i + 3800));
  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, text: chunk, parse_mode: "Markdown" }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) throw new Error(json.description ?? "Telegram rejected the message");
  }
}
