import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { RecordDialog, type FieldSpec } from "@/components/RecordDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  money,
  today,
  useDeleteRow,
  useTable,
  type Account,
  type DailyLog,
  type Movement,
  type Named,
  type Row,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/movements")({
  head: () => ({
    meta: [
      { title: "Movements — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Move a balance out of a finished account through your wallet and into a reserve account, with the opening balance recorded automatically.",
      },
      { property: "og:title", content: "Movements — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Withdraw, top up and redeposit between broker accounts in one record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovementsPage,
});

/** Last known balance of an account: newest closing, else newest opening, else first deposit. */
export function lastKnownBalance(accountId: string, logs: DailyLog[], accounts: Account[]) {
  const mine = logs
    .filter((l) => l.account_id === accountId)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
  for (const l of mine) {
    if (l.closing_balance != null) return Number(l.closing_balance);
    if (l.opening_balance != null) return Number(l.opening_balance);
  }
  const acc = accounts.find((a) => a.id === accountId);
  return Number(acc?.first_deposit ?? 0);
}

function MovementsPage() {
  const { data: movements = [] } = useTable<Movement>("movements", "move_date", false);
  const { data: accounts = [] } = useTable<Account>("accounts");
  const { data: wallets = [] } = useTable<Named>("payment_sources", "name", true);
  const { data: logs = [] } = useTable<DailyLog>("daily_logs", "log_date", false);
  const del = useDeleteRow("movements", ["accounts", "daily_logs", "funding_events"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const label = (id: string | null | undefined) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.broker} ${a.account_name}` : "—";
  };
  const walletName = (id: string | null | undefined) =>
    wallets.find((w) => w.id === id)?.name ?? "—";

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.broker} ${a.account_name} (${a.status})`,
      })),
    [accounts],
  );
  const walletOptions = useMemo(
    () => wallets.filter((w) => w.is_active !== false).map((w) => ({ value: w.id, label: w.name })),
    [wallets],
  );

  const fields: FieldSpec[] = [
    { name: "move_date", label: "Date", type: "date", required: true },
    {
      name: "from_account_id",
      label: "From account (HFM / Tickmill)",
      type: "select",
      required: true,
      options: accountOptions,
    },
    { name: "withdraw_amount", label: "Last balance withdrawn", type: "number", required: true },
    {
      name: "payment_source_id",
      label: "Withdrawn to wallet",
      type: "select",
      required: true,
      options: walletOptions,
    },
    { name: "extra_amount", label: "Extra amount added", type: "number" },
    {
      name: "extra_source_id",
      label: "Extra amount from",
      type: "select",
      options: walletOptions,
    },
    {
      name: "to_account_id",
      label: "Deposited to reserve account",
      type: "select",
      required: true,
      options: accountOptions,
    },
    { name: "note", label: "Note", type: "textarea" },
  ];

  const record = useMutation({
    mutationFn: async (v: Row) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");

      const fromId = String(v["from_account_id"]);
      const toId = String(v["to_account_id"]);
      if (fromId === toId) throw new Error("Choose two different accounts");

      const moveDate = String(v["move_date"] || today());
      const withdraw = Number(v["withdraw_amount"] ?? 0);
      const extra = Number(v["extra_amount"] ?? 0);
      const deposit = withdraw + extra;
      const before = lastKnownBalance(toId, logs, accounts);
      const after = before + deposit;

      const { error: mErr } = await supabase.from("movements").insert({
        user_id: userId,
        move_date: moveDate,
        from_account_id: fromId,
        to_account_id: toId,
        payment_source_id: (v["payment_source_id"] as string) ?? null,
        extra_source_id: (v["extra_source_id"] as string) ?? null,
        withdraw_amount: withdraw,
        extra_amount: extra,
        deposit_amount: deposit,
        to_balance_before: before,
        to_balance_after: after,
        note: (v["note"] as string) ?? null,
      });
      if (mErr) throw mErr;

      // Money in and out of the wallet keeps the ledger honest.
      const { error: fErr } = await supabase.from("funding_events").insert({
        user_id: userId,
        account_id: toId,
        event_date: moveDate,
        kind: "redeposit",
        amount: withdraw,
        source_type: "movement",
        from_account_id: fromId,
        payment_source_id: (v["payment_source_id"] as string) ?? null,
        balance_before: before,
        balance_after: before + withdraw,
        note: "Account movement",
      });
      if (fErr) throw fErr;

      if (extra > 0) {
        const { error: eErr } = await supabase.from("funding_events").insert({
          user_id: userId,
          account_id: toId,
          event_date: moveDate,
          kind: "deposit",
          amount: extra,
          source_type: "movement-extra",
          payment_source_id: (v["extra_source_id"] as string) ?? null,
          balance_before: before + withdraw,
          balance_after: after,
          note: "Extra amount added on movement",
        });
        if (eErr) throw eErr;
      }

      // The emptied account is churned, the receiving one becomes active today.
      const { error: c1 } = await supabase
        .from("accounts")
        .update({ status: "churned" })
        .eq("id", fromId);
      if (c1) throw c1;

      const { error: c2 } = await supabase
        .from("accounts")
        .update({ status: "active", activated_on: moveDate })
        .eq("id", toId);
      if (c2) throw c2;

      // Opening balance of the receiving account shows up automatically.
      const { error: lErr } = await supabase
        .from("daily_logs")
        .upsert(
          {
            user_id: userId,
            account_id: toId,
            log_date: moveDate,
            opening_balance: after,
            note: "Opening after movement",
          },
          { onConflict: "account_id,log_date" },
        );
      if (lErr) throw lErr;
    },
    onSuccess: () => {
      ["movements", "accounts", "daily_logs", "funding_events"].forEach((t) =>
        qc.invalidateQueries({ queryKey: [t] }),
      );
      toast.success("Movement recorded");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Account movements"
        subtitle="Withdraw a finished account, pass it through your wallet, redeposit into a reserve account."
        actions={
          <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New movement
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movement history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="text-right">Withdrawn</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead className="text-right">Extra</TableHead>
                <TableHead>Extra from</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Deposited</TableHead>
                <TableHead className="text-right">Before</TableHead>
                <TableHead className="text-right">Opening after</TableHead>
                <TableHead>Note</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                    No movements recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{m.move_date}</TableCell>
                  <TableCell className="text-sm">{label(m.from_account_id)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(m.withdraw_amount)}
                  </TableCell>
                  <TableCell className="text-xs">{walletName(m.payment_source_id)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(m.extra_amount) > 0 ? money(m.extra_amount) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {Number(m.extra_amount) > 0 ? walletName(m.extra_source_id) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      {label(m.to_account_id)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{money(m.deposit_amount)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(m.to_balance_before)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Badge variant="outline">{money(m.to_balance_after)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate text-xs text-muted-foreground">
                    {m.note ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete movement"
                      onClick={() => del.mutate(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="New movement"
        description="The receiving account is activated automatically and its opening balance is written for the day."
        fields={fields}
        initial={{ move_date: today(), extra_amount: 0 }}
        onSubmit={(v) => record.mutate(v)}
      />
    </div>
  );
}
