import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TableName =
  | "vps"
  | "accounts"
  | "bots"
  | "daily_logs"
  | "funding_events"
  | "costs"
  | "transactions"
  | "people"
  | "payment_sources"
  | "problems"
  | "movements"
  | "cost_purposes"
  | "day_results"
  | "saved_reports";

export type Row = Record<string, unknown>;

export interface Problem extends Row {
  id: string;
  title: string;
  details: string | null;
  status: "pending" | "action" | "fixed";
  action_note: string | null;
  solved_on: string | null;
  created_at: string;
}

export interface Movement extends Row {
  id: string;
  move_date: string;
  from_account_id: string | null;
  to_account_id: string | null;
  payment_source_id: string | null;
  extra_source_id: string | null;
  withdraw_amount: number;
  extra_amount: number;
  deposit_amount: number;
  to_balance_before: number | null;
  to_balance_after: number | null;
  note: string | null;
}


export interface Vps extends Row {
  id: string;
  name: string;
  vps_number: string | null;
  ip: string | null;
  username: string | null;
  password: string | null;
  email: string | null;
  provider: string | null;
  notes: string | null;
  purchased_on: string | null;
  term_days: number;

}

export interface Account extends Row {
  id: string;
  broker: string;
  account_name: string;
  email: string | null;
  password: string | null;
  login: string | null;
  login_password: string | null;
  first_deposit: number;
  status: "active" | "reserve" | "churned";
  vps_id: string | null;
  activated_on: string | null;
  cycle_days: number;
  notes: string | null;

}

export interface DailyLog extends Row {
  id: string;
  account_id: string;
  log_date: string;
  opening_balance: number | null;
  closing_balance: number | null;
  note: string | null;
}

export interface FundingEvent extends Row {
  id: string;
  account_id: string;
  event_date: string;
  kind: "deposit" | "redeposit" | "withdraw";
  amount: number;
  source_type: string;
  from_account_id: string | null;
  payment_source_id: string | null;
  balance_before: number | null;
  balance_after: number | null;
  from_balance_before: number | null;
  from_balance_after: number | null;
  has_fee: boolean;
  fee: number;
  note: string | null;
}

export interface Bot extends Row {
  id: string;
  username: string | null;
  magic_number: number;
  email: string | null;
  password: string | null;
  status: "pending" | "registered";
  vps_id: string | null;
  notes: string | null;
}

export interface Cost extends Row {
  id: string;
  cost_date: string;
  reason: string;
  amount: number;
  payment_source_id: string | null;
  vps_id: string | null;
  notes: string | null;
  purpose: string | null;
  is_subscription: boolean;
  starts_on: string | null;
  duration_value: number | null;
  duration_unit: "hour" | "day" | "week" | "month";
  notify_before_hours: number;
}

export interface Transaction extends Row {
  id: string;
  tx_date: string;
  direction: "sent" | "received";
  amount: number;
  person_id: string | null;
  payment_source_id: string | null;
  reason: string | null;
}

export interface DayResult extends Row {
  id: string;
  result_date: string;
  vps_id: string | null;
  register_number: string | null;
  direction: "profit" | "loss";
  amount: number;
  label: string | null;
  note: string | null;
}

export interface SavedReport extends Row {
  id: string;
  name: string;
  kind: "daily" | "weekly" | "monthly";
  from_date: string;
  to_date: string;
  heading: string;
  sheets: unknown;
  theory: unknown;
  created_at: string;
}

export interface Named extends Row {
  id: string;
  name: string;
  starting_balance: number;
  is_active: boolean;
  notes: string | null;
}

export type LedgerEntry = {
  id: string;
  date: string;
  label: string;
  delta: number;
};

export function walletLedger(
  wallet: Named,
  {
    costs,
    funding,
    transactions,
    accountLabel,
  }: {
    costs: Cost[];
    funding: FundingEvent[];
    transactions: Transaction[];
    accountLabel: (id: string | null) => string;
  },
): LedgerEntry[] {
  const rows: LedgerEntry[] = [];
  const mine = (id: string | null) => id === wallet.id;

  funding
    .filter((f) => mine(f.payment_source_id))
    .forEach((f) => {
      if (f.kind === "withdraw") {
        rows.push({
          id: `${f.id}-w`,
          date: f.event_date,
          label: `Withdraw from ${accountLabel(f.account_id)}`,
          delta: Number(f.amount),
        });
        return;
      }
      if (f.kind === "redeposit") {
        const pulled =
          f.from_balance_before != null && f.from_balance_after != null
            ? Number(f.from_balance_before) - Number(f.from_balance_after)
            : Number(f.amount);
        rows.push({
          id: `${f.id}-in`,
          date: f.event_date,
          label: `Withdraw from ${accountLabel(f.from_account_id)}`,
          delta: pulled,
        });
      }
      rows.push({
        id: `${f.id}-out`,
        date: f.event_date,
        label: `${f.kind === "deposit" ? "Deposit to" : "Redeposit to"} ${accountLabel(f.account_id)}`,
        delta: -Number(f.amount),
      });
    });

  costs
    .filter((c) => mine(c.payment_source_id))
    .forEach((c) =>
      rows.push({ id: c.id, date: c.cost_date, label: `Cost — ${c.reason}`, delta: -Number(c.amount) }),
    );

  transactions
    .filter((t) => mine(t.payment_source_id))
    .forEach((t) =>
      rows.push({
        id: t.id,
        date: t.tx_date,
        label: t.direction === "sent" ? "Sent out" : "Received",
        delta: t.direction === "sent" ? -Number(t.amount) : Number(t.amount),
      }),
    );

  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function walletBalance(wallet: Named, entries: LedgerEntry[]) {
  return entries.reduce((s, e) => s + e.delta, Number(wallet.starting_balance ?? 0));
}


export function useTable<T>(table: TableName, orderBy = "created_at", ascending = false) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderBy, { ascending });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function useSaveRow(table: TableName, extraInvalidate: TableName[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Row) => {
      const { id, ...rest } = row as { id?: string };
      const payload = rest as Row;
      if (id) {
        const { error } = await supabase
          .from(table)
          .update(payload as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        payload["user_id"] = await currentUserId();
        const { error } = await supabase.from(table).insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      extraInvalidate.forEach((t) => qc.invalidateQueries({ queryKey: [t] }));
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRow(table: TableName, extraInvalidate: TableName[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      extraInvalidate.forEach((t) => qc.invalidateQueries({ queryKey: [t] }));
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

const WIPE_ORDER: TableName[] = [
  "saved_reports",
  "day_results",
  "movements",
  "funding_events",
  "daily_logs",
  "transactions",
  "costs",
  "problems",
  "bots",
  "accounts",
  "vps",
  "people",
  "payment_sources",
  "cost_purposes",
];

export function useWipeAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const uid = await currentUserId();
      for (const table of WIPE_ORDER) {
        const { error } = await supabase.from(table).delete().eq("user_id", uid);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("All records deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const money = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : `$${Number(v).toFixed(2)}`;

export const today = () => new Date().toISOString().slice(0, 10);
