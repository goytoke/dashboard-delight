import type { Account, Cost, Vps } from "@/lib/db";

export type ExpiryAlert = {
  id: string;
  kind: "vps" | "account" | "subscription";
  label: string;
  daysLeft: number;
  endDate: string;
};

const DAY = 86_400_000;

export function daysUntil(dateStr: string) {
  const end = new Date(`${dateStr}T00:00:00`).getTime();
  const start = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((end - start) / DAY);
}

export function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Deadline = {
  endDate: string;
  daysLeft: number;
  expired: boolean;
};

/** Term of one VPS: purchase date + its term (falls back to the configured default). */
export function vpsDeadline(v: Vps, defaultTermDays = 3): Deadline | null {
  if (!v.purchased_on) return null;
  const endDate = addDays(String(v.purchased_on), Number(v.term_days ?? defaultTermDays));
  const daysLeft = daysUntil(endDate);
  return { endDate, daysLeft, expired: daysLeft < 0 };
}

/** Cycle of one account: activation date + its cycle (falls back to the configured default). */
export function accountDeadline(a: Account, defaultCycleDays = 14): Deadline | null {
  if (a.status !== "active" || !a.activated_on) return null;
  const endDate = addDays(String(a.activated_on), Number(a.cycle_days ?? defaultCycleDays));
  const daysLeft = daysUntil(endDate);
  return { endDate, daysLeft, expired: daysLeft < 0 };
}

/** VPS about to expire — alerts stop once the deadline has passed. */
export function vpsExpiry(servers: Vps[], alertBeforeDays = 1, defaultTermDays = 3): ExpiryAlert[] {
  return servers
    .map((v) => ({ v, d: vpsDeadline(v, defaultTermDays) }))
    .filter((x): x is { v: Vps; d: Deadline } => x.d !== null)
    .map(({ v, d }) => ({
      id: `vps-${v.id}`,
      kind: "vps" as const,
      label: `VPS ${v.name}`,
      endDate: d.endDate,
      daysLeft: d.daysLeft,
    }))
    .filter((a) => a.daysLeft >= 0 && a.daysLeft <= alertBeforeDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Active accounts about to reach the end of their cycle — alerts stop after the deadline. */
export function accountExpiry(
  accounts: Account[],
  alertBeforeDays = 2,
  defaultCycleDays = 14,
): ExpiryAlert[] {
  return accounts
    .map((a) => ({ a, d: accountDeadline(a, defaultCycleDays) }))
    .filter((x): x is { a: Account; d: Deadline } => x.d !== null)
    .map(({ a, d }) => ({
      id: `acc-${a.id}`,
      kind: "account" as const,
      label: `${a.broker} ${a.account_name}`,
      endDate: d.endDate,
      daysLeft: d.daysLeft,
    }))
    .filter((a) => a.daysLeft >= 0 && a.daysLeft <= alertBeforeDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}


export function expiryText(a: ExpiryAlert) {
  if (a.daysLeft < 0) return `expired ${Math.abs(a.daysLeft)} day(s) ago`;
  if (a.daysLeft === 0) return "last day — expires today";
  return `${a.daysLeft} day(s) left`;
}

const HOUR = 3_600_000;

export type Subscription = {
  id: string;
  label: string;
  purpose: string;
  amount: number;
  startsOn: string;
  endsAt: Date;
  hoursLeft: number;
  daysLeft: number;
  notifyBeforeHours: number;
  due: boolean;
};

const UNIT_HOURS: Record<string, number> = { hour: 1, day: 24, week: 168, month: 720 };

/** Paid subscriptions (VPS term, extra logins, anything custom) with their deadline. */
export function subscriptions(costs: Cost[]): Subscription[] {
  return costs
    .filter((c) => c.is_subscription && c.duration_value && (c.starts_on || c.cost_date))
    .map((c) => {
      const start = String(c.starts_on ?? c.cost_date);
      const hours = Number(c.duration_value) * (UNIT_HOURS[c.duration_unit ?? "day"] ?? 24);
      const endsAt = new Date(new Date(`${start}T00:00:00`).getTime() + hours * HOUR);
      const hoursLeft = Math.round((endsAt.getTime() - Date.now()) / HOUR);
      const notifyBeforeHours = Number(c.notify_before_hours ?? 24);
      return {
        id: c.id,
        label: c.purpose ? `${c.purpose} — ${c.reason}` : c.reason,
        purpose: c.purpose ?? "Other",
        amount: Number(c.amount),
        startsOn: start,
        endsAt,
        hoursLeft,
        daysLeft: Math.floor(hoursLeft / 24),
        notifyBeforeHours,
        due: hoursLeft <= notifyBeforeHours,
      };
    })
    .sort((a, b) => a.hoursLeft - b.hoursLeft);
}

export function subscriptionAlerts(costs: Cost[]): ExpiryAlert[] {
  return subscriptions(costs)
    .filter((s) => s.due)
    .map((s) => ({
      id: `sub-${s.id}`,
      kind: "subscription" as const,
      label: s.label,
      daysLeft: s.daysLeft,
      endDate: s.endsAt.toISOString().slice(0, 16).replace("T", " "),
    }));
}

export function subscriptionText(s: Subscription) {
  if (s.hoursLeft < 0) return `expired ${Math.abs(s.hoursLeft)}h ago`;
  if (s.hoursLeft < 24) return `${s.hoursLeft}h left`;
  return `${s.daysLeft} day(s) left`;
}
