import type { Sheet } from "@/lib/export";
import {
  accountDeadline,
  subscriptions,
  subscriptionText,
  vpsDeadline,
  type Subscription,
} from "@/lib/alerts";
import type { Account, Cost, Problem, Vps } from "@/lib/db";
import type { DeadlineConfig } from "@/lib/settings";

const statusText = (daysLeft: number, expired: boolean) =>
  expired ? `expired ${Math.abs(daysLeft)} day(s) ago` : daysLeft === 0 ? "last day" : `${daysLeft} day(s) left`;

export type StatusRows = {
  boughtToday: Subscription[];
  running: Subscription[];
  vpsRows: { name: string; endDate: string; daysLeft: number; expired: boolean }[];
  accountRows: { label: string; endDate: string; daysLeft: number; expired: boolean }[];
};

export function statusRows(
  date: string,
  config: DeadlineConfig,
  data: { costs: Cost[]; vpsList: Vps[]; accounts: Account[] },
): StatusRows {
  const subs = subscriptions(data.costs);
  return {
    boughtToday: subs.filter((s) => s.startsOn === date),
    running: subs.filter((s) => s.startsOn !== date),
    vpsRows: data.vpsList
      .map((v) => ({ v, d: vpsDeadline(v, config.vpsTermDays) }))
      .filter((x) => x.d)
      .map(({ v, d }) => ({ name: v.name, ...d! })),
    accountRows: data.accounts
      .map((a) => ({ a, d: accountDeadline(a, config.accountCycleDays) }))
      .filter((x) => x.d)
      .map(({ a, d }) => ({ label: `${a.broker} ${a.account_name}`, ...d! })),
  };
}

/** Subscription purchases, VPS/account deadlines and every problem, as report sheets. */
export function statusSheets(date: string, s: StatusRows, problems: Problem[]): Sheet[] {
  const subCols = ["Purpose", "Details", "Amount", "Started", "Deadline", "Status"];
  const subRow = (x: Subscription) => [
    x.purpose,
    x.label,
    x.amount,
    x.startsOn,
    x.endsAt.toLocaleString(),
    subscriptionText(x),
  ];

  return [
    {
      title: `Subscriptions bought on ${date}`,
      columns: subCols,
      rows: s.boughtToday.length
        ? s.boughtToday.map(subRow)
        : [[`No subscription was bought on ${date}.`, "", "", "", "", ""]],
    },
    {
      title: "Subscriptions still running",
      columns: subCols,
      rows: s.running.length
        ? s.running.map(subRow)
        : [["No other subscription is running.", "", "", "", "", ""]],
    },
    {
      title: "VPS deadlines",
      columns: ["VPS", "Deadline", "Status"],
      rows: s.vpsRows.length
        ? s.vpsRows.map((v) => [v.name, v.endDate, statusText(v.daysLeft, v.expired)])
        : [["No VPS has a purchase date, so no deadline can be counted.", "", ""]],
    },
    {
      title: "Account deadlines",
      columns: ["Account", "Deadline", "Status"],
      rows: s.accountRows.length
        ? s.accountRows.map((a) => [a.label, a.endDate, statusText(a.daysLeft, a.expired)])
        : [["No active account has an activation date, so no deadline can be counted.", "", ""]],
    },
    {
      title: "Problems",
      columns: ["Title", "Status", "Action taken", "Solved on", "Details"],
      rows: problems.length
        ? problems.map((p) => [
            p.title,
            p.status,
            p.action_note ?? "",
            p.solved_on ?? "",
            p.details ?? "",
          ])
        : [["No problem recorded.", "", "", "", ""]],
    },
  ];
}

export { statusText };
