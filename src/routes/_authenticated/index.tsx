import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Server,
  Wallet,
  Bot as BotIcon,
  Receipt,
  TrendingUp,
  ArrowDownUp,
  Plus,
  Pencil,
  Trash2,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordDialog } from "@/components/RecordDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/PageHeader";
import { ExpiryAlertDialog, useExpiryAlerts } from "@/components/ExpiryAlerts";
import { expiryText, subscriptions, subscriptionText } from "@/lib/alerts";
import {
  money,
  today,
  useSaveRow,
  useDeleteRow,
  useTable,

  walletBalance,
  walletLedger,
  type Account,
  type Bot,
  type Cost,
  type DailyLog,
  type FundingEvent,
  type Named,
  type Transaction,
  type Movement,
  type Vps,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Grand opening and closing balances, net of the day, wallet balances and renewal alerts for VPS and accounts.",
      },
      { property: "og:title", content: "Dashboard — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Today's totals, wallets and renewal reminders in one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data: servers = [] } = useTable<Vps>("vps");
  const { data: accounts = [] } = useTable<Account>("accounts");
  const { data: bots = [] } = useTable<Bot>("bots");
  const { data: costs = [] } = useTable<Cost>("costs");
  const { data: logs = [] } = useTable<DailyLog>("daily_logs", "log_date", false);
  const { data: funding = [] } = useTable<FundingEvent>("funding_events", "event_date", false);
  const { data: wallets = [] } = useTable<Named>("payment_sources", "name", true);
  const { data: txs = [] } = useTable<Transaction>("transactions", "tx_date", false);
  const { data: movements = [] } = useTable<Movement>("movements", "move_date", false);
  const saveWallet = useSaveRow("payment_sources");
  const deleteWallet = useDeleteRow("payment_sources");

  const [walletOpen, setWalletOpen] = useState(false);
  const [walletEditing, setWalletEditing] = useState<Named | null>(null);

  const accountLabel = (id: string | null) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.broker} ${a.account_name}` : "—";
  };

  const date = today();
  const active = accounts.filter((a) => a.status === "active");
  const todayLogs = logs.filter((l) => l.log_date === date);
  const dayPl = todayLogs.reduce(
    (s, l) =>
      l.opening_balance != null && l.closing_balance != null
        ? s + (Number(l.closing_balance) - Number(l.opening_balance))
        : s,
    0,
  );
  const totalCosts = costs.reduce((s, c) => s + Number(c.amount), 0);
  const todayFunding = funding.filter((f) => f.event_date === date);
  const grandOpening = todayLogs.reduce((s, l) => s + Number(l.opening_balance ?? 0), 0);
  const grandClosing = todayLogs.reduce((s, l) => s + Number(l.closing_balance ?? 0), 0);
  const costToday = costs
    .filter((c) => c.cost_date === date)
    .reduce((s, c) => s + Number(c.amount), 0);
  const todayTxs = txs.filter((t) => t.tx_date === date);
  const netToday =
    dayPl -
    costToday -
    todayTxs.filter((t) => t.direction === "sent").reduce((s, t) => s + Number(t.amount), 0) +
    todayTxs.filter((t) => t.direction === "received").reduce((s, t) => s + Number(t.amount), 0);
  const movedToday = movements
    .filter((m) => m.move_date === date)
    .reduce((s, m) => s + Number(m.deposit_amount ?? 0), 0);
  const alerts = useExpiryAlerts(servers, accounts, costs);
  const subs = subscriptions(costs);

  return (
    <div>
      <ExpiryAlertDialog alerts={alerts} />
      <PageHeader title="Dashboard" subtitle={`Daily report — ${date}`} />

      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
            >
              <span className="font-medium">{a.label}</span>{" "}
              <span className="text-muted-foreground">
                — {expiryText(a)} (ends {a.endDate})
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Grand opening total" value={money(grandOpening)} />
        <Stat icon={Wallet} label="Grand closing total" value={money(grandClosing)} />
        <Stat
          icon={TrendingUp}
          label="Net of today"
          value={`${netToday >= 0 ? "+" : ""}${netToday.toFixed(2)}`}
          hint={`Costs ${money(costToday)} · trading ${dayPl.toFixed(2)}`}
        />
        <Stat
          icon={ArrowDownUp}
          label="Moved between accounts"
          value={money(movedToday)}
          hint="Does not change the net"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat icon={Server} label="VPS" value={String(servers.length)} />
        <Stat
          icon={Wallet}
          label="Active accounts"
          value={String(active.length)}
          hint={`${accounts.filter((a) => a.status === "reserve").length} reserve · ${accounts.filter((a) => a.status === "churned").length} churned`}
        />
        <Stat
          icon={BotIcon}
          label="Bots"
          value={String(bots.filter((b) => b.status === "registered").length)}
          hint={`${bots.filter((b) => b.status === "pending").length} generated`}
        />
        <Stat
          icon={TrendingUp}
          label="Today P/L"
          value={`${dayPl >= 0 ? "+" : ""}${dayPl.toFixed(2)}`}
        />
        <Stat
          icon={ArrowDownUp}
          label="Funding today"
          value={String(todayFunding.length)}
          hint={money(todayFunding.reduce((s, f) => s + Number(f.amount), 0))}
        />
        <Stat icon={Receipt} label="Total costs" value={money(totalCosts)} />
      </div>


      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Wallets</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => {
              setWalletEditing(null);
              setWalletOpen(true);
            }}>
            <Plus className="mr-1 h-4 w-4" /> Add wallet
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {wallets.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add your Binance wallet with the balance it has right now — every deposit, redeposit,
              cost and transaction keeps it up to date.
            </p>
          )}
          {wallets.map((w) => {
            const entries = walletLedger(w, { costs, funding, transactions: txs, accountLabel });
            const balance = walletBalance(w, entries);
            const active = w.is_active !== false;
            return (
              <div
                key={w.id}
                className={`rounded-md border border-border ${active ? "" : "opacity-60"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      {w.name}
                      {!active && <Badge variant="outline">Inactive</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started at {money(w.starting_balance)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-semibold">{money(balance)}</p>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={active}
                        onCheckedChange={(v: boolean) =>
                          saveWallet.mutate({ id: w.id, is_active: v })
                        }
                        aria-label="Wallet active"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit wallet"
                        onClick={() => {
                          setWalletEditing(w);
                          setWalletOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete wallet"
                        className="text-destructive"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete wallet "${w.name}"? Costs and transactions linked to it keep their record but lose the wallet name.`,
                            )
                          ) {
                            deleteWallet.mutate(w.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                    </div>
                  </div>
                </div>
                {entries.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Movement</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.slice(0, 8).map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs">{e.date}</TableCell>
                          <TableCell className="text-sm">{e.label}</TableCell>
                          <TableCell
                            className={`text-right font-mono ${e.delta >= 0 ? "text-primary" : "text-destructive"}`}
                          >
                            {e.delta >= 0 ? "+" : "-"}
                            {Math.abs(e.delta).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <RecordDialog
        open={walletOpen}
        onOpenChange={setWalletOpen}
        title={walletEditing ? "Edit wallet" : "Add wallet"}
        description="For example Binance — enter the balance it holds today."
        initial={walletEditing}
        fields={[
          { name: "name", label: "Wallet name", required: true },
          { name: "starting_balance", label: "Current balance", type: "number" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={(v) => {
          saveWallet.mutate(v);
          setWalletOpen(false);
          setWalletEditing(null);
        }}
      />


      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Subscriptions &amp; deadlines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No subscription recorded yet — add one from the Costs page.
                  </TableCell>
                </TableRow>
              )}
              {subs.map((s) => (
                <TableRow key={s.id} className={s.due ? "bg-destructive/10" : undefined}>
                  <TableCell className="font-medium">{s.purpose}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.label}</TableCell>
                  <TableCell>{money(s.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{s.startsOn}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.endsAt.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.due ? "destructive" : "outline"}>{subscriptionText(s)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s active accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>VPS</TableHead>
                <TableHead>Opening</TableHead>
                <TableHead>Closing</TableHead>
                <TableHead>P/L</TableHead>
                <TableHead>Deposits</TableHead>
                <TableHead>Redeposits</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No active accounts yet.
                  </TableCell>
                </TableRow>
              )}
              {active.map((a) => {
                const log = todayLogs.find((l) => l.account_id === a.id);
                const pl =
                  log?.opening_balance != null && log?.closing_balance != null
                    ? Number(log.closing_balance) - Number(log.opening_balance)
                    : null;
                const dep = todayFunding.filter(
                  (f) => f.account_id === a.id && f.kind === "deposit",
                );
                const redep = todayFunding.filter(
                  (f) => f.account_id === a.id && f.kind === "redeposit",
                );
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.broker} {a.account_name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {servers.find((v) => v.id === a.vps_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell>{money(log?.opening_balance)}</TableCell>
                    <TableCell>{money(log?.closing_balance)}</TableCell>
                    <TableCell>
                      {pl === null ? (
                        "—"
                      ) : (
                        <span className={pl >= 0 ? "text-primary" : "text-destructive"}>
                          {pl >= 0 ? "+" : ""}
                          {pl.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {dep.length} · {money(dep.reduce((s, f) => s + Number(f.amount), 0))}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {redep.length} · {money(redep.reduce((s, f) => s + Number(f.amount), 0))}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {log?.note ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
