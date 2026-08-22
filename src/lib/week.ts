import { computeDay, type DaySnapshot } from "@/lib/day";
import type {
  Account,
  Cost,
  DailyLog,
  FundingEvent,
  Movement,
  Problem,
  Transaction,
  Vps,
} from "@/lib/db";

export type WeekData = {
  accounts: Account[];
  logs: DailyLog[];
  funding: FundingEvent[];
  costs: Cost[];
  transactions: Transaction[];
  movements: Movement[];
  problems: Problem[];
  vpsList: Vps[];
};

export type WeekDay = { date: string; snapshot: DaySnapshot };

export type WeekReport = {
  from: string;
  to: string;
  days: WeekDay[];
  firstDate: string | null;
  lastDate: string | null;
  firstOpening: number;
  lastClosing: number;
  grandOpening: number;
  grandClosing: number;
  tradingNet: number;
  costTotal: number;
  sent: number;
  received: number;
  fundedTotal: number;
  withdrawnTotal: number;
  movedTotal: number;
  netOfWeek: number;
  weekChange: number;
  accountOpenings: { label: string; firstOpening: number | null; lastClosing: number | null }[];
  problemsSolved: Problem[];
  problemsOpen: Problem[];
  weekCosts: Cost[];
  subscriptionCosts: Cost[];
  vpsUsed: number;
};

export function dateRange(from: string, to: string) {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end && out.length < 366) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function startOfWeek(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeWeek(from: string, to: string, data: WeekData): WeekReport {
  const { accounts, logs, funding, costs, transactions, movements, problems, vpsList } = data;
  const dates = dateRange(from, to);

  const days: WeekDay[] = dates.map((date) => ({
    date,
    snapshot: computeDay(date, { accounts, logs, funding, costs, transactions, movements }),
  }));

  const withData = days.filter(
    (d) => d.snapshot.rows.some((r) => r.opening != null || r.closing != null),
  );
  const first = withData[0] ?? null;
  const last = withData[withData.length - 1] ?? null;

  const sum = (pick: (s: DaySnapshot) => number) => days.reduce((s, d) => s + pick(d.snapshot), 0);

  const inRange = (d: string) => d >= from && d <= to;
  const weekLogs = logs.filter((l) => inRange(l.log_date));
  const accountOpenings = accounts
    .map((a) => {
      const mine = weekLogs
        .filter((l) => l.account_id === a.id)
        .sort((x, y) => (x.log_date < y.log_date ? -1 : 1));
      const firstLog = mine.find((l) => l.opening_balance != null);
      const lastLog = [...mine].reverse().find((l) => l.closing_balance != null);
      return {
        label: `${a.broker} ${a.account_name}`,
        firstOpening: firstLog?.opening_balance == null ? null : Number(firstLog.opening_balance),
        lastClosing: lastLog?.closing_balance == null ? null : Number(lastLog.closing_balance),
      };
    })
    .filter((r) => r.firstOpening != null || r.lastClosing != null);

  const weekCosts = costs.filter((c) => inRange(c.cost_date));
  const problemsSolved = problems.filter(
    (p) => p.status === "fixed" && p.solved_on != null && inRange(p.solved_on),
  );
  const problemsOpen = problems.filter((p) => p.status !== "fixed");

  const firstOpening = first?.snapshot.grand_opening ?? 0;
  const lastClosing = last?.snapshot.grand_closing ?? 0;
  const costTotal = sum((s) => s.cost_total);
  const sent = sum((s) => s.sent);
  const received = sum((s) => s.received);
  const tradingNet = sum((s) => s.trading_net);

  const usedVps = new Set(
    accounts
      .filter((a) => a.vps_id && (a.status === "active" || weekLogs.some((l) => l.account_id === a.id)))
      .map((a) => String(a.vps_id)),
  );

  return {
    from,
    to,
    days,
    firstDate: first?.date ?? null,
    lastDate: last?.date ?? null,
    firstOpening,
    lastClosing,
    grandOpening: sum((s) => s.grand_opening),
    grandClosing: sum((s) => s.grand_closing),
    tradingNet,
    costTotal,
    sent,
    received,
    fundedTotal: sum((s) => s.funded_total),
    withdrawnTotal: sum((s) => s.withdrawn_total ?? 0),
    movedTotal: sum((s) => s.moved_total),
    netOfWeek: tradingNet - costTotal - sent + received,
    weekChange: lastClosing - firstOpening,
    accountOpenings,
    problemsSolved,
    problemsOpen,
    weekCosts,
    subscriptionCosts: weekCosts.filter((c) => c.is_subscription),
    vpsUsed: usedVps.size || vpsList.length,
  };
}
