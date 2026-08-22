import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpFromLine, CalendarDays, PlusCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { FundingDialog } from "@/components/FundingDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { DayResults } from "@/components/DayResults";
import { supabase } from "@/integrations/supabase/client";
import {
  money,
  today,
  useDeleteRow,
  useSaveRow,
  useTable,
  walletBalance,
  walletLedger,
  type Account,
  type Cost,
  type DailyLog,
  type DayResult,
  type FundingEvent,
  type Named,
  type Row,
  type Transaction,
  type Vps,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/daily-log")({
  component: DailyLogPage,
});

function DailyLogPage() {
  const [date, setDate] = useState(today());
  const { data: accounts = [] } = useTable<Account>("accounts");
  const { data: logs = [] } = useTable<DailyLog>("daily_logs", "log_date", false);
  const { data: wallets = [] } = useTable<Named>("payment_sources", "name", true);
  const { data: vpsList = [] } = useTable<Vps>("vps", "vps_number", true);
  const { data: funding = [] } = useTable<FundingEvent>("funding_events", "event_date", false);
  const { data: costs = [] } = useTable<Cost>("costs", "cost_date", false);
  const { data: txs = [] } = useTable<Transaction>("transactions", "tx_date", false);
  const { data: dayResults = [] } = useTable<DayResult>("day_results", "created_at", false);

  const saveFunding = useSaveRow("funding_events", ["payment_sources", "daily_logs"]);
  const delFunding = useDeleteRow("funding_events", ["payment_sources"]);
  const saveResult = useSaveRow("day_results");
  const delResult = useDeleteRow("day_results");
  const qc = useQueryClient();

  const [fundOpen, setFundOpen] = useState(false);
  const [fundInitial, setFundInitial] = useState<Row | null>(null);
  const [wdOpen, setWdOpen] = useState(false);
  const [wdAccount, setWdAccount] = useState<string | null>(null);

  const active = useMemo(() => accounts.filter((a) => a.status === "active"), [accounts]);

  const accountLabel = (id: string | null | undefined) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.broker} ${a.account_name}` : "—";
  };
  const walletName = (id: string | null | undefined) =>
    wallets.find((w) => w.id === id)?.name ?? "—";

  const walletBalanceOf = (walletId: string) => {
    const w = wallets.find((x) => x.id === walletId);
    if (!w) return null;
    return walletBalance(w, walletLedger(w, { costs, funding, transactions: txs, accountLabel }));
  };

  const upsertLog = useMutation({
    mutationFn: async (row: Row) => {
      const { data } = await supabase.auth.getUser();
      const payload = { ...row, user_id: data.user?.id, log_date: date };
      const { error } = await supabase
        .from("daily_logs")
        .upsert(payload as never, { onConflict: "account_id,log_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_logs"] });
      toast.success("Day saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suggestedBalance = (accountId: string) => {
    const todayLog = logs.find((l) => l.account_id === accountId && l.log_date === date);
    if (todayLog?.closing_balance != null) return Number(todayLog.closing_balance);
    if (todayLog?.opening_balance != null) return Number(todayLog.opening_balance);
    const prev = logs
      .filter((l) => l.account_id === accountId && l.log_date < date && l.closing_balance !== null)
      .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))[0];
    if (prev?.closing_balance != null) return Number(prev.closing_balance);
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.first_deposit != null ? Number(acc.first_deposit) : null;
  };

  const dayEvents = funding.filter((f) => f.event_date === date);
  const deposits = dayEvents.filter((f) => f.kind === "deposit");
  const redeposits = dayEvents.filter((f) => f.kind === "redeposit");
  const withdrawals = dayEvents.filter((f) => f.kind === "withdraw");
  const sum = (list: FundingEvent[]) => list.reduce((s, f) => s + Number(f.amount ?? 0), 0);

  const EventTable = ({
    list,
    kind,
  }: {
    list: FundingEvent[];
    kind: "deposit" | "redeposit" | "withdraw";
  }) => (
    <Table>
      <TableHeader>
        <TableRow>
          {kind === "redeposit" && <TableHead>From account</TableHead>}
          {kind === "redeposit" && <TableHead className="text-right">Withdrawn</TableHead>}
          {kind === "redeposit" && <TableHead className="text-right">Left there</TableHead>}
          <TableHead>Wallet</TableHead>
          <TableHead>{kind === "withdraw" ? "From account" : "To account"}</TableHead>
          <TableHead className="text-right">Balance before</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Balance after</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.length === 0 && (
          <TableRow>
            <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
              Nothing recorded on {date}.
            </TableCell>
          </TableRow>
        )}
        {list.map((f) => (
          <TableRow key={f.id}>
            {kind === "redeposit" && <TableCell>{accountLabel(f.from_account_id)}</TableCell>}
            {kind === "redeposit" && (
              <TableCell className="text-right font-mono">
                {f.from_balance_before != null && f.from_balance_after != null
                  ? money(Number(f.from_balance_before) - Number(f.from_balance_after))
                  : money(f.amount)}
              </TableCell>
            )}
            {kind === "redeposit" && (
              <TableCell className="text-right font-mono">{money(f.from_balance_after)}</TableCell>
            )}
            <TableCell>{walletName(f.payment_source_id)}</TableCell>
            <TableCell>{accountLabel(f.account_id)}</TableCell>
            <TableCell className="text-right font-mono">{money(f.balance_before)}</TableCell>
            <TableCell className="text-right font-mono font-medium">{money(f.amount)}</TableCell>
            <TableCell className="text-right font-mono">{money(f.balance_after)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{f.note ?? "—"}</TableCell>
            <TableCell className="text-right">
              <Button size="icon" variant="ghost" onClick={() => delFunding.mutate(f.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div>
      <PageHeader
        title="Daily Log"
        subtitle="Active accounts only. Opening balance carries over from the previous closing balance."
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setFundInitial({ event_date: date, kind: "deposit" });
                setFundOpen(true);
              }}
            >
              <PlusCircle className="mr-1 h-4 w-4" /> Deposit / Redeposit
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setWdAccount(null);
                setWdOpen(true);
              }}
            >
              <ArrowUpFromLine className="mr-1 h-4 w-4" /> Withdraw
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="w-36">Opening</TableHead>
                <TableHead className="w-36">Closing</TableHead>
                <TableHead className="w-28">P/L</TableHead>
                <TableHead className="w-32">Funding today</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-24 text-right">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No active accounts. Mark an account active on the Accounts page.
                  </TableCell>
                </TableRow>
              )}
              {active.map((a) => (
                <LogRow
                  key={`${a.id}-${date}-${logs.length}-${funding.length}`}
                  account={a}
                  date={date}
                  logs={logs}
                  funding={funding}
                  onSave={(row) => upsertLog.mutate(row)}
                  onFund={() => {
                    setFundInitial({
                      account_id: a.id,
                      event_date: date,
                      kind: "deposit",
                    });
                    setFundOpen(true);
                  }}
                  onWithdraw={() => {
                    setWdAccount(a.id);
                    setWdOpen(true);
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Records of {date}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Only the day you picked above is shown. Change the date to see another day.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="deposit">
            <div className="px-6 pb-3">
              <TabsList>
                <TabsTrigger value="deposit">
                  Direct deposit ({deposits.length} · {money(sum(deposits))})
                </TabsTrigger>
                <TabsTrigger value="redeposit">
                  Redeposit ({redeposits.length} · {money(sum(redeposits))})
                </TabsTrigger>
                <TabsTrigger value="withdraw">
                  Withdraw ({withdrawals.length} · {money(sum(withdrawals))})
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="deposit" className="m-0">
              <EventTable list={deposits} kind="deposit" />
            </TabsContent>
            <TabsContent value="redeposit" className="m-0">
              <EventTable list={redeposits} kind="redeposit" />
            </TabsContent>
            <TabsContent value="withdraw" className="m-0">
              <EventTable list={withdrawals} kind="withdraw" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <DayResults
        date={date}
        vpsList={vpsList}
        results={dayResults}
        onSave={(row) => saveResult.mutate(row)}
        onDelete={(id) => delResult.mutate(id)}
      />

      <FundingDialog
        open={fundOpen}
        onOpenChange={setFundOpen}
        accounts={accounts}
        wallets={wallets.filter((w) => w.is_active !== false)}
        vpsList={vpsList}
        initial={fundInitial}
        suggestedBalance={suggestedBalance}
        walletBalanceOf={walletBalanceOf}
        onSubmit={(vals) => {
          saveFunding.mutate(vals);
          setFundOpen(false);
        }}
      />

      <WithdrawDialog
        open={wdOpen}
        onOpenChange={setWdOpen}
        accounts={accounts}
        wallets={wallets.filter((w) => w.is_active !== false)}
        vpsList={vpsList}
        date={date}
        initialAccountId={wdAccount}
        suggestedBalance={suggestedBalance}
        walletBalanceOf={walletBalanceOf}
        onSubmit={(vals) => {
          saveFunding.mutate(vals);
          setWdOpen(false);
        }}
      />
    </div>
  );
}

function LogRow({
  account,
  date,
  logs,
  funding,
  onSave,
  onFund,
  onWithdraw,
}: {
  account: Account;
  date: string;
  logs: DailyLog[];
  funding: FundingEvent[];
  onSave: (row: Row) => void;
  onFund: () => void;
  onWithdraw: () => void;
}) {
  const todayLog = logs.find((l) => l.account_id === account.id && l.log_date === date);
  const previous = logs
    .filter((l) => l.account_id === account.id && l.log_date < date && l.closing_balance !== null)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))[0];

  const carried = previous?.closing_balance == null ? null : Number(previous.closing_balance);

  const [opening, setOpening] = useState<string>(
    todayLog?.opening_balance != null
      ? String(todayLog.opening_balance)
      : carried != null
        ? String(carried)
        : account.first_deposit
          ? String(account.first_deposit)
          : "",
  );
  const [closing, setClosing] = useState<string>(
    todayLog?.closing_balance != null ? String(todayLog.closing_balance) : "",
  );
  const [note, setNote] = useState<string>(todayLog?.note ?? "");

  const openValue = opening === "" ? null : Number(opening);
  const closeValue = closing === "" ? null : Number(closing);
  const pl = openValue != null && closeValue != null ? closeValue - openValue : null;
  const changedManually = carried != null && openValue != null && openValue !== carried;

  const dayFunding = funding.filter((f) => f.account_id === account.id && f.event_date === date);

  const save = () => {
    if (changedManually && !note.trim()) {
      toast.error("You changed the opening balance by hand — write a note saying why.");
      return;
    }
    onSave({
      account_id: account.id,
      opening_balance: openValue,
      closing_balance: closeValue,
      note: changedManually
        ? `Opening balance changed manually from ${carried} to ${openValue} — ${note.trim()}`
        : note || null,
    });
  };

  return (
    <TableRow key={`${account.id}-${date}`}>
      <TableCell>
        <div className="font-medium">
          {account.broker} {account.account_name}
        </div>
        <div className="text-xs text-muted-foreground">First deposit {money(account.first_deposit)}</div>
      </TableCell>
      <TableCell>
        <Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
        {carried != null && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {changedManually
              ? `Yesterday closed at ${carried} — note required`
              : `Carried from ${previous?.log_date}`}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Input type="number" value={closing} onChange={(e) => setClosing(e.target.value)} />
      </TableCell>
      <TableCell>
        {pl === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={pl >= 0 ? "text-primary" : "text-destructive"}>
            {pl >= 0 ? "+" : ""}
            {pl.toFixed(2)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onFund} title="Add deposit / redeposit">
            <PlusCircle className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onWithdraw} title="Withdraw to wallet">
            <ArrowUpFromLine className="h-4 w-4" />
          </Button>
          {dayFunding.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {dayFunding.length} · {money(dayFunding.reduce((s, f) => s + Number(f.amount), 0))}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={changedManually ? "Why did you change the opening?" : "Note..."}
          className={changedManually && !note.trim() ? "border-destructive" : ""}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" onClick={save}>
          <Save className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
