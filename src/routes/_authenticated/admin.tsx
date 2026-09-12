import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TodoRow } from "@/routes/_authenticated/notes";
import { useNotes, useSaveNote } from "@/lib/notes";
import {
  money,
  useTable,
  walletBalance,
  walletLedger,
  type Account,
  type Bot,
  type Cost,
  type FundingEvent,
  type Named,
  type Problem,
  type SavedReport,
  type Transaction,
  type Vps,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin overview — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Read-only overview of servers, accounts, wallets, costs, bots, problems and saved reports, with a note board.",
      },
      { property: "og:title", content: "Admin overview — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Read-only workspace overview with notes and to-do progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: vpsList = [] } = useTable<Vps>("vps", "name", true);
  const { data: accounts = [] } = useTable<Account>("accounts", "account_name", true);
  const { data: bots = [] } = useTable<Bot>("bots", "magic_number", true);
  const { data: costs = [] } = useTable<Cost>("costs", "cost_date", false);
  const { data: wallets = [] } = useTable<Named>("payment_sources", "name", true);
  const { data: problems = [] } = useTable<Problem>("problems");
  const { data: reports = [] } = useTable<SavedReport>("saved_reports");
  const { data: funding = [] } = useTable<FundingEvent>("funding_events", "event_date", false);
  const { data: transactions = [] } = useTable<Transaction>("transactions", "tx_date", false);
  const { data: logs = [] } = useTable<Record<string, unknown>>("daily_logs", "log_date", false);

  const { data: notes = [] } = useNotes();
  const save = useSaveNote();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const accountLabel = (id: string | null) =>
    accounts.find((a) => a.id === id)?.account_name ?? "—";

  const latestBalance = (accountId: string) => {
    const row = logs.find(
      (l) => l["account_id"] === accountId && l["closing_balance"] !== null,
    ) as { closing_balance?: number } | undefined;
    return row?.closing_balance ?? null;
  };

  const walletRows = useMemo(
    () =>
      wallets.map((w) => ({
        wallet: w,
        balance: walletBalance(
          w,
          walletLedger(w, { costs, funding, transactions, accountLabel }),
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallets, costs, funding, transactions, accounts],
  );

  const todos = notes.filter((n) => n.is_todo);
  const overall = todos.length
    ? Math.round(todos.reduce((s, n) => s + (n.done ? 100 : n.progress), 0) / todos.length)
    : 0;

  const activeAccounts = accounts.filter((a) => a.status === "active");

  const addNote = () => {
    if (!title.trim()) {
      toast.error("Type a title first.");
      return;
    }
    save.mutate(
      { title: title.trim(), body: body.trim() || null },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin overview"
        subtitle="Everything happening in the workspace, read-only. Leave a note and it shows up on the owner's board."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Servers in use" value={String(vpsList.length)} />
        <Stat
          label="Accounts"
          value={`${accounts.length} (${activeAccounts.length} active)`}
        />
        <Stat label="Bots" value={String(bots.length)} />
        <Stat
          label="Open problems"
          value={String(problems.filter((p) => p.status !== "fixed").length)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts and current balance</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Current balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.account_name}</TableCell>
                  <TableCell>{a.broker}</TableCell>
                  <TableCell>{vpsList.find((v) => v.id === a.vps_id)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {money(latestBalance(a.id) ?? a.first_deposit)}
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No accounts yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wallets (Binance and others)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {walletRows.map(({ wallet, balance }) => (
              <div key={wallet.id} className="flex items-center justify-between text-sm">
                <span>{wallet.name}</span>
                <span className="font-medium">{money(balance)}</span>
              </div>
            ))}
            {walletRows.length === 0 && (
              <p className="text-sm text-muted-foreground">No wallets yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {costs.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {c.cost_date} · {c.reason}
                </span>
                <span className="font-medium">{money(c.amount)}</span>
              </div>
            ))}
            {costs.length === 0 && <p className="text-sm text-muted-foreground">No costs yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Problems</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {problems.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{p.title}</span>
                <Badge variant={p.status === "fixed" ? "outline" : "destructive"}>{p.status}</Badge>
              </div>
            ))}
            {problems.length === 0 && (
              <p className="text-sm text-muted-foreground">No problems reported.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved reports ({reports.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.name}</span>
                <Badge variant="outline">{r.kind}</Badge>
              </div>
            ))}
            {reports.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">To-do progress ({todos.length})</CardTitle>
          <div className="w-40">
            <Progress value={overall} />
            <p className="mt-1 text-right text-xs text-muted-foreground">{overall}% done</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {todos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing on the to-do list yet.</p>
          )}
          {todos.map((n) => (
            <TodoRow key={n.id} note={n} readOnly />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave a note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Details (optional)</Label>
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button onClick={addNote} disabled={save.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Send note
          </Button>
          <div className="space-y-2 pt-2">
            {notes
              .filter((n) => !n.is_todo)
              .slice(0, 6)
              .map((n) => (
                <div key={n.id} className="rounded-md border border-border p-2 text-sm">
                  <div className="font-medium">{n.title}</div>
                  {n.body && <p className="text-muted-foreground">{n.body}</p>}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
