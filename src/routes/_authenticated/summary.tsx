import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { ReportExport } from "@/components/ReportExport";
import { computeDay } from "@/lib/day";
import { addDays, endOfMonth, startOfMonth, startOfWeek, dateRange } from "@/lib/week";
import { grandTotals, type MoneyContext } from "@/lib/report-sections";
import { resultsNetOf } from "@/components/DayResults";
import type { Sheet } from "@/lib/export";
import {
  money,
  today,
  useTable,
  type Account,
  type Cost,
  type DailyLog,
  type DayResult,
  type FundingEvent,
  type Movement,
  type Named,
  type Transaction,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({
    meta: [
      { title: "Weekly & Monthly Summary — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Grand opening on the first trading day against the grand closing on Friday, week by week and month by month, checked against profit, costs and transfers.",
      },
      { property: "og:title", content: "Weekly & Monthly Summary — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Week and month totals that must match your recorded profit, costs and transfers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SummaryPage,
});

const round = (n: number) => Number(n.toFixed(2));

type DayInfo = {
  date: string;
  opening: number;
  closing: number;
  diff: number;
  pl: number;
  costs: number;
  sent: number;
  received: number;
  net: number;
  hasData: boolean;
};

type Block = {
  label: string;
  from: string;
  to: string;
  days: DayInfo[];
  opening: number;
  closing: number;
  diff: number;
  pl: number;
  costs: number;
  sent: number;
  received: number;
  net: number;
};

function buildBlock(label: string, dates: string[], info: (d: string) => DayInfo): Block {
  const days = dates.map(info);
  const recorded = days.filter((d) => d.hasData);
  const first = recorded[0];
  const last = recorded[recorded.length - 1];
  const sum = (k: keyof DayInfo) => recorded.reduce((s, d) => s + (d[k] as number), 0);
  const opening = first?.opening ?? 0;
  const closing = last?.closing ?? 0;
  return {
    label,
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
    days,
    opening,
    closing,
    diff: closing - opening,
    pl: sum("pl"),
    costs: sum("costs"),
    sent: sum("sent"),
    received: sum("received"),
    net: sum("net"),
  };
}

function SummaryPage() {
  const { data: accounts = [] } = useTable<Account>("accounts");
  const { data: logs = [] } = useTable<DailyLog>("daily_logs", "log_date", false);
  const { data: costs = [] } = useTable<Cost>("costs", "cost_date", false);
  const { data: txs = [] } = useTable<Transaction>("transactions", "tx_date", false);
  const { data: funding = [] } = useTable<FundingEvent>("funding_events", "event_date", false);
  const { data: movements = [] } = useTable<Movement>("movements", "move_date", false);
  const { data: wallets = [] } = useTable<Named>("payment_sources", "name", true);
  const { data: dayResults = [] } = useTable<DayResult>("day_results", "created_at", false);

  const [weekStart, setWeekStart] = useState(startOfWeek(today()));
  const [month, setMonth] = useState(today().slice(0, 7));

  const accountLabel = (id: string | null | undefined) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.broker} ${a.account_name}` : "—";
  };
  const walletName = (id: string | null | undefined) =>
    wallets.find((w) => w.id === id)?.name ?? "—";

  const moneyCtx: MoneyContext = {
    wallets,
    costs,
    funding,
    transactions: txs,
    movements,
    accountLabel,
    walletName,
  };

  const dayInfo = useMemo(() => {
    return (date: string): DayInfo => {
      const snap = computeDay(date, {
        accounts,
        logs,
        funding,
        costs,
        transactions: txs,
        movements,
      });
      const t = grandTotals(date, moneyCtx, snap.rows);
      const results = dayResults.filter((r) => r.result_date === date);
      const pl = resultsNetOf(results);
      const net = pl + snap.received - snap.cost_total - snap.sent;
      return {
        date,
        opening: t.grandOpening,
        closing: t.grandClosing,
        diff: t.grandClosing - t.grandOpening,
        pl,
        costs: snap.cost_total,
        sent: snap.sent,
        received: snap.received,
        net,
        hasData:
          snap.rows.some((r) => r.opening != null || r.closing != null) ||
          results.length > 0 ||
          snap.cost_total !== 0 ||
          snap.sent !== 0 ||
          snap.received !== 0,
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, logs, funding, costs, txs, movements, dayResults, wallets]);

  // Monday → Friday only: Saturday and Sunday are not traded.
  const weekDates = dateRange(weekStart, addDays(weekStart, 4));
  const week = buildBlock(`Week of ${weekStart}`, weekDates, dayInfo);

  const monthFrom = startOfMonth(`${month}-01`);
  const monthTo = endOfMonth(`${month}-01`);
  const monthWeeks: Block[] = useMemo(() => {
    const out: Block[] = [];
    let cursor = startOfWeek(monthFrom);
    let n = 1;
    while (cursor <= monthTo && n <= 6) {
      const dates = dateRange(cursor, addDays(cursor, 4)).filter(
        (d) => d >= monthFrom && d <= monthTo,
      );
      if (dates.length) out.push(buildBlock(`Week ${n}`, dates, dayInfo));
      cursor = addDays(cursor, 7);
      n += 1;
    }
    return out;
  }, [monthFrom, monthTo, dayInfo]);

  const monthDates = dateRange(monthFrom, monthTo).filter((d) => {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    return wd !== 0 && wd !== 6;
  });
  const monthBlock = buildBlock(
    new Date(`${monthFrom}T00:00:00Z`).toLocaleString("en", { month: "long", year: "numeric" }),
    monthDates,
    dayInfo,
  );

  const sheets: Sheet[] = [
    {
      title: `Week ${week.from} → ${week.to} — day by day`,
      columns: ["Date", "Grand opening", "Grand closing", "Difference", "Profit/loss", "Costs", "Sent", "Received", "Net"],
      rows: [
        ...week.days.map((d) => [
          d.date,
          round(d.opening),
          round(d.closing),
          round(d.diff),
          round(d.pl),
          round(d.costs),
          round(d.sent),
          round(d.received),
          round(d.net),
        ]),
        [
          "WEEK TOTAL",
          round(week.opening),
          round(week.closing),
          round(week.diff),
          round(week.pl),
          round(week.costs),
          round(week.sent),
          round(week.received),
          round(week.net),
        ],
      ],
    },
    {
      title: `${monthBlock.label} — week by week`,
      columns: ["Week", "From", "To", "Grand opening", "Grand closing", "Difference", "Profit/loss", "Costs", "Sent", "Received", "Net"],
      rows: [
        ...monthWeeks.map((w) => [
          w.label,
          w.from,
          w.to,
          round(w.opening),
          round(w.closing),
          round(w.diff),
          round(w.pl),
          round(w.costs),
          round(w.sent),
          round(w.received),
          round(w.net),
        ]),
        [
          "MONTH TOTAL",
          monthBlock.from,
          monthBlock.to,
          round(monthBlock.opening),
          round(monthBlock.closing),
          round(monthBlock.diff),
          round(monthBlock.pl),
          round(monthBlock.costs),
          round(monthBlock.sent),
          round(monthBlock.received),
          round(monthBlock.net),
        ],
      ],
    },
  ];

  const theory = [
    `The week runs Monday to Friday only, because Saturday and Sunday are not traded.`,
    `Week ${week.from} → ${week.to}: grand opening ${money(week.opening)} on the first traded day, grand closing ${money(week.closing)} on the last traded day, so the difference is ${week.diff.toFixed(2)}.`,
    `Recorded profit or loss ${week.pl.toFixed(2)} plus transfers received ${week.received.toFixed(2)} minus costs ${week.costs.toFixed(2)} and transfers sent ${week.sent.toFixed(2)} gives a net of ${week.net.toFixed(2)}.`,
    Math.abs(week.diff - week.net) < 0.01
      ? "The difference and the net match, so the week balances."
      : `The difference and the net are ${Math.abs(week.diff - week.net).toFixed(2)} apart — something in the week is not recorded yet.`,
    `${monthBlock.label}: grand opening ${money(monthBlock.opening)}, grand closing ${money(monthBlock.closing)}, difference ${monthBlock.diff.toFixed(2)}, net ${monthBlock.net.toFixed(2)}.`,
    `Every figure counts the trading accounts, the reserve accounts and every wallet (Binance included) added together.`,
  ];

  return (
    <div>
      <PageHeader
        title="Summary"
        subtitle="Week (Monday to Friday) and month totals: grand opening against grand closing, checked against your profit, costs and transfers."
        actions={
          <ReportExport
            heading={`Summary — week ${week.from} to ${week.to} and ${monthBlock.label}`}
            fileBase={`summary-${week.from}_${month}`}
            sheets={sheets}
            theory={theory}
          />
        }
      />

      <Card className="mb-6">
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Week — {week.from} → {week.to}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monday to Friday. Saturday and Sunday are left out because you do not trade then.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="week-start" className="text-xs text-muted-foreground">
                Week starts on
              </Label>
              <Input
                id="week-start"
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(startOfWeek(e.target.value || today()))}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-0 pb-6">
          <div className="grid gap-3 px-6 sm:grid-cols-2 xl:grid-cols-4">
            <Box label="Grand opening (first day)" value={money(week.opening)} />
            <Box label="Grand closing (Friday)" value={money(week.closing)} />
            <Box
              label="Difference (closing − opening)"
              value={`${week.diff >= 0 ? "+" : ""}${week.diff.toFixed(2)}`}
            />
            <Box
              label="Net (profit + received − costs − sent)"
              value={`${week.net >= 0 ? "+" : ""}${week.net.toFixed(2)}`}
            />
          </div>
          <div className="px-6">
            <MatchBadge diff={week.diff} net={week.net} />
          </div>
          <DayTable block={week} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Month — {monthBlock.label}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Week 1, week 2, week 3, week 4 and the month total, all counting accounts, reserve
            accounts and every wallet.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="month-pick" className="text-xs text-muted-foreground">
                Month
              </Label>
              <Input
                id="month-pick"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || today().slice(0, 7))}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-0 pb-6">
          <div className="grid gap-3 px-6 sm:grid-cols-2 xl:grid-cols-4">
            <Box label="Grand opening (first day)" value={money(monthBlock.opening)} />
            <Box label="Grand closing (last day)" value={money(monthBlock.closing)} />
            <Box
              label="Difference"
              value={`${monthBlock.diff >= 0 ? "+" : ""}${monthBlock.diff.toFixed(2)}`}
            />
            <Box
              label="Net"
              value={`${monthBlock.net >= 0 ? "+" : ""}${monthBlock.net.toFixed(2)}`}
            />
          </div>
          <div className="px-6">
            <MatchBadge diff={monthBlock.diff} net={monthBlock.net} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>Range</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Closing</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">Profit / loss</TableHead>
                <TableHead className="text-right">Costs</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthWeeks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    Nothing recorded in this month yet.
                  </TableCell>
                </TableRow>
              )}
              {monthWeeks.map((w) => (
                <TableRow key={w.label}>
                  <TableCell className="font-medium">{w.label}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {w.from} → {w.to}
                  </TableCell>
                  <TableCell className="text-right font-mono">{money(w.opening)}</TableCell>
                  <TableCell className="text-right font-mono">{money(w.closing)}</TableCell>
                  <TableCell className="text-right font-mono">{w.diff.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{w.pl.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{w.costs.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{w.sent.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{w.received.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{w.net.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Month total</TableCell>
                <TableCell className="font-mono text-xs">
                  {monthBlock.from} → {monthBlock.to}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(monthBlock.opening)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(monthBlock.closing)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {monthBlock.diff.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {monthBlock.pl.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {monthBlock.costs.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {monthBlock.sent.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {monthBlock.received.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {monthBlock.net.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DayTable({ block }: { block: Block }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Grand opening</TableHead>
          <TableHead className="text-right">Grand closing</TableHead>
          <TableHead className="text-right">Difference</TableHead>
          <TableHead className="text-right">Profit / loss</TableHead>
          <TableHead className="text-right">Costs</TableHead>
          <TableHead className="text-right">Sent</TableHead>
          <TableHead className="text-right">Received</TableHead>
          <TableHead className="text-right">Net</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {block.days.map((d) => (
          <TableRow key={d.date} className={d.hasData ? "" : "opacity-50"}>
            <TableCell className="font-mono text-xs">{d.date}</TableCell>
            <TableCell className="text-right font-mono">{money(d.opening)}</TableCell>
            <TableCell className="text-right font-mono">{money(d.closing)}</TableCell>
            <TableCell className="text-right font-mono">{d.diff.toFixed(2)}</TableCell>
            <TableCell className="text-right font-mono">{d.pl.toFixed(2)}</TableCell>
            <TableCell className="text-right font-mono">{d.costs.toFixed(2)}</TableCell>
            <TableCell className="text-right font-mono">{d.sent.toFixed(2)}</TableCell>
            <TableCell className="text-right font-mono">{d.received.toFixed(2)}</TableCell>
            <TableCell className="text-right font-mono">{d.net.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell className="text-right font-mono font-semibold">{money(block.opening)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{money(block.closing)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{block.diff.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{block.pl.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{block.costs.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{block.sent.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{block.received.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{block.net.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function MatchBadge({ diff, net }: { diff: number; net: number }) {
  const gap = diff - net;
  const ok = Math.abs(gap) < 0.01;
  return (
    <Badge variant={ok ? "outline" : "destructive"} className="justify-start">
      {ok
        ? "Closing − opening matches the profit, costs and transfers."
        : `Off by ${gap.toFixed(2)} — closing − opening does not match the recorded profit, costs and transfers yet.`}
    </Badge>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
