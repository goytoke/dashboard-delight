import type { Sheet } from "@/lib/export";
import type { Account, Bot, DailyLog, Vps } from "@/lib/db";

export type InventoryData = {
  vpsList: Vps[];
  accounts: Account[];
  bots: Bot[];
  logs: DailyLog[];
};

/** Latest known closing balance of an account on or before `asOf`. */
export function latestBalance(accountId: string, asOf: string, logs: DailyLog[]) {
  const rows = logs
    .filter((l) => l.account_id === accountId && l.log_date <= asOf && l.closing_balance != null)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
  const first = rows[0];
  return first ? Number(first.closing_balance) : null;
}

/**
 * The "what do we run right now" part of every report: servers in use,
 * accounts with their latest balance, and the bots working on them.
 */
export function inventorySheets(asOf: string, label: string, d: InventoryData): Sheet[] {
  const vpsName = (id: string | null) => d.vpsList.find((v) => v.id === id)?.name ?? "—";

  const accountRows = d.accounts.map((a) => [
    `${a.broker} ${a.account_name}`,
    a.status,
    vpsName(a.vps_id),
    latestBalance(a.id, asOf, d.logs) ?? "",
    a.activated_on ?? "",
  ]);
  const totalBalance = d.accounts.reduce(
    (s, a) => s + (latestBalance(a.id, asOf, d.logs) ?? 0),
    0,
  );

  return [
    {
      title: `Servers in use — ${label}`,
      columns: ["VPS", "Number", "Provider", "Bought on", "Term (days)", "Accounts on it", "Bots on it"],
      rows: d.vpsList.length
        ? [
            ...d.vpsList.map((v) => [
              v.name,
              v.vps_number ?? "",
              v.provider ?? "",
              v.purchased_on ?? "",
              v.term_days,
              d.accounts.filter((a) => a.vps_id === v.id).length,
              d.bots.filter((b) => b.vps_id === v.id).length,
            ]),
            ["TOTAL SERVERS", String(d.vpsList.length), "", "", "", d.accounts.length, d.bots.length],
          ]
        : [["No server recorded, so nothing is running yet.", "", "", "", "", "", ""]],
    },
    {
      title: `Accounts and latest balance — ${label}`,
      columns: ["Account", "Status", "VPS", "Latest balance", "Activated on"],
      rows: d.accounts.length
        ? [...accountRows, ["TOTAL", String(d.accounts.length), "", Number(totalBalance.toFixed(2)), ""]]
        : [["No account recorded.", "", "", "", ""]],
    },
    {
      title: `Bots — ${label}`,
      columns: ["Username", "Magic number", "Status", "VPS", "Notes"],
      rows: d.bots.length
        ? [
            ...d.bots.map((b) => [
              b.username ?? "",
              b.magic_number,
              b.status,
              vpsName(b.vps_id),
              b.notes ?? "",
            ]),
            [
              `TOTAL ${d.bots.length} bot(s): ${d.bots.filter((b) => b.status === "registered").length} registered, ${d.bots.filter((b) => b.status !== "registered").length} waiting`,
              "",
              "",
              "",
              "",
            ],
          ]
        : [["No bot recorded.", "", "", "", ""]],
    },
  ];
}
