import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Account, Cost, DailyLog, FundingEvent, Movement, Row, Transaction } from "@/lib/db";

export interface TradingDay extends Row {
  id: string;
  day_date: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  grand_opening: number | null;
  grand_closing: number | null;
  net_of_day: number | null;
  snapshot: DaySnapshot | null;
  note: string | null;
}

export interface SnapshotRow {
  account_id: string;
  label: string;
  status: string;
  opening: number | null;
  closing: number | null;
  pl: number | null;
  deposits: number;
  withdrawals?: number;
  note: string | null;
}

export interface DaySnapshot {
  rows: SnapshotRow[];
  grand_opening: number;
  grand_closing: number;
  trading_net: number;
  net_of_day: number;
  cost_total: number;
  sent: number;
  received: number;
  moved_total: number;
  funded_total: number;
  withdrawn_total?: number;
}

export function computeDay(
  date: string,
  data: {
    accounts: Account[];
    logs: DailyLog[];
    funding: FundingEvent[];
    costs: Cost[];
    transactions: Transaction[];
    movements: Movement[];
  },
): DaySnapshot {
  const { accounts, logs, funding, costs, transactions, movements } = data;
  const dayLogs = logs.filter((l) => l.log_date === date);
  const dayFunding = funding.filter((f) => f.event_date === date);

  const rows: SnapshotRow[] = accounts
    .map((a) => {
      const log = dayLogs.find((l) => l.account_id === a.id);
      const opening = log?.opening_balance == null ? null : Number(log.opening_balance);
      const closing = log?.closing_balance == null ? null : Number(log.closing_balance);
      const funded = dayFunding.filter((f) => f.account_id === a.id);
      return {
        account_id: a.id,
        label: `${a.broker} ${a.account_name}`,
        status: a.status,
        opening,
        closing,
        pl: opening != null && closing != null ? closing - opening : null,
        deposits: funded
          .filter((f) => f.kind !== "withdraw")
          .reduce((s, f) => s + Number(f.amount), 0),
        withdrawals: funded
          .filter((f) => f.kind === "withdraw")
          .reduce((s, f) => s + Number(f.amount), 0),
        note: log?.note ?? null,
        hasData: Boolean(log) || funded.length > 0,
      };
    })
    .filter((r) => r.hasData || r.status === "active")
    .map(({ hasData: _hasData, ...r }) => r);

  const grand_opening = rows.reduce((s, r) => s + (r.opening ?? 0), 0);
  const grand_closing = rows.reduce((s, r) => s + (r.closing ?? 0), 0);
  const trading_net = rows.reduce((s, r) => s + (r.pl ?? 0), 0);
  const cost_total = costs
    .filter((c) => c.cost_date === date)
    .reduce((s, c) => s + Number(c.amount), 0);
  const dayTxs = transactions.filter((t) => t.tx_date === date);
  const sent = dayTxs
    .filter((t) => t.direction === "sent")
    .reduce((s, t) => s + Number(t.amount), 0);
  const received = dayTxs
    .filter((t) => t.direction === "received")
    .reduce((s, t) => s + Number(t.amount), 0);
  const moved_total = movements
    .filter((m) => m.move_date === date)
    .reduce((s, m) => s + Number(m.deposit_amount ?? 0), 0);

  return {
    rows,
    grand_opening,
    grand_closing,
    trading_net,
    net_of_day: trading_net - cost_total - sent + received,
    cost_total,
    sent,
    received,
    moved_total,
    funded_total: dayFunding
      .filter((f) => f.kind !== "withdraw")
      .reduce((s, f) => s + Number(f.amount), 0),
    withdrawn_total: dayFunding
      .filter((f) => f.kind === "withdraw")
      .reduce((s, f) => s + Number(f.amount), 0),
  };
}

export function useTradingDays() {
  return useQuery({
    queryKey: ["trading_days"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_days")
        .select("*")
        .order("day_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TradingDay[];
    },
  });
}

export function useOpenDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("trading_days").upsert(
        {
          user_id: auth.user.id,
          day_date: date,
          status: "open",
          opened_at: new Date().toISOString(),
          closed_at: null,
          grand_opening: null,
          grand_closing: null,
          net_of_day: null,
          snapshot: null,
        } as never,
        { onConflict: "user_id,day_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading_days"] });
      toast.success("Day opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCloseDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, snapshot }: { date: string; snapshot: DaySnapshot }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("trading_days").upsert(
        {
          user_id: auth.user.id,
          day_date: date,
          status: "closed",
          closed_at: new Date().toISOString(),
          grand_opening: snapshot.grand_opening,
          grand_closing: snapshot.grand_closing,
          net_of_day: snapshot.net_of_day,
          snapshot: snapshot as unknown as Row,
        } as never,
        { onConflict: "user_id,day_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading_days"] });
      toast.success("Day closed — report locked with the stored totals");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
