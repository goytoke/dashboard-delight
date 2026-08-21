import { useState } from "react";
import { Download, FileText, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  download,
  sheetsToCsv,
  sheetsToHtml,
  sheetsToText,
  type Sheet,
} from "@/lib/export";
import { loadTelegramConfig, saveTelegramConfig, sendTelegramMessage } from "@/lib/telegram";

export function ReportExport({
  heading,
  fileBase,
  sheets,
  theory,
}: {
  heading: string;
  fileBase: string;
  sheets: Sheet[];
  theory: string[];
}) {
  const [cfgOpen, setCfgOpen] = useState(false);
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [sending, setSending] = useState(false);

  const openConfig = () => {
    const cfg = loadTelegramConfig();
    setToken(cfg.token);
    setChatId(cfg.chatId);
    setCfgOpen(true);
  };

  const send = async () => {
    const cfg = loadTelegramConfig();
    if (!cfg.token || !cfg.chatId) {
      toast.error("Add your Telegram bot token and chat ID first");
      openConfig();
      return;
    }
    setSending(true);
    try {
      await sendTelegramMessage(cfg, sheetsToText(heading, sheets, theory));
      toast.success("Report sent to Telegram");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() =>
            download(`${fileBase}.csv`, sheetsToCsv(sheets, theory), "text/csv;charset=utf-8")
          }
        >
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            download(
              `${fileBase}.doc`,
              sheetsToHtml(heading, sheets, theory),
              "application/msword;charset=utf-8",
            )
          }
        >
          <FileText className="mr-1 h-4 w-4" /> Word
        </Button>
        <Button onClick={send} disabled={sending}>
          <Send className="mr-1 h-4 w-4" /> {sending ? "Sending..." : "Telegram"}
        </Button>
        <Button variant="ghost" size="icon" onClick={openConfig} aria-label="Configure Telegram bot">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Telegram bot</DialogTitle>
            <DialogDescription>
              Paste the bot token from BotFather and the chat ID that should receive the report. It
              is stored on this device only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bot token</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Chat ID</Label>
              <Input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-1001234567890"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCfgOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveTelegramConfig({ token: token.trim(), chatId: chatId.trim() });
                setCfgOpen(false);
                toast.success("Telegram bot saved");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
