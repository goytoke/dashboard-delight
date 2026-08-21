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
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { DayControl, useDayFor } from "@/components/DayControl";
import { computeDay } from "@/lib/day";
import { subscriptions, subscriptionText } from "@/lib/alerts";
import { addDays, computeWeek, startOfWeek, type WeekReport } from "@/lib/week";
import { ReportExport } from "@/components/ReportExport";
import type { Sheet } from "@/lib/export";
import {
  binanceClosing,
  grandTotalSheet,
  grandTotals,
  moneySheets,
  moneyTheory,
  type MoneyContext,
} from "@/lib/report-sections";
import { statusRows, statusSheets, statusText } from "@/lib/report-status";
import { useDeadlineConfig } from "@/lib/settings";

import {
  money,
  today,
  useTable,
  type Account,
  type Cost,
  type DailyLog,
  type FundingEvent,
  type Movement,
  type Named,
  type Problem,
  type Transaction,
  type Vps,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Daily Report — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Table report of opening and closing balances per account, grand totals, net of the day plus costs, transfers and movements.",
      },
      { property: "og:title", content: "Daily Report — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Grand opening, grand closing, net of the day and the full theory behind it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});


function ReportPage() {
  const [date, setDate] = useState(today());
  const { data: accounts = [] } = useTable<Account>("accounts");
  const { data: logs = [] } = useTable<DailyLog>("daily_logs", "log_date", false);
  const { data: costs = [] } = useTable<Cost>("costs", "cost_date", false);
  const { data: txs = [] } = useTable<Transaction>("transactions", "tx_date", false);
  const { data: funding = [] } = useTable<FundingEvent>("funding_events", "event_date", false);
  const { data: movements = [] } = useTable<Movement>("movements", "move_date", false);
  const { data: problems = [] } = useTable<Problem>("problems");
  const { data: wallets = [] } = useTable<Named>("payment_sources", "name", true);
  const { data: vpsList = [] } = useTable<Vps>("vps", "vps_number", true);

  const [weekFrom, setWeekFrom] = useState(startOfWeek(today()));
  const [weekTo, setWeekTo] = useState(addDays(startOfWeek(today()), 6));
  const [week, setWeek] = useState<WeekReport | null>(null);

  const generateWeek = () =>
    setWeek(
      computeWeek(weekFrom, weekTo, {
        accounts,
        logs,
        funding,
        costs,
        transactions: txs,
        movements,
        problems,
        vpsList,
      }),
    );

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
  const binanceDay = binanceClosing(date, moneyCtx);

  const day = useDayFor(date);
  const live = useMemo(
    () => computeDay(date, { accounts, logs, funding, costs, transactions: txs, movements }),
    [date, accounts, logs, funding, costs, txs, movements],
  );
  const stored = day?.status === "closed" ? day.snapshot : null;
  const view = stored ?? live;

  const rows = view.rows;
  const grandOpening = view.grand_opening;
  const grandClosing = view.grand_closing;
  const tradingNet = view.trading_net;
  const costTotal = view.cost_total;
  const sent = view.sent;
  const received = view.received;
  const movedTotal = view.moved_total;
  const netOfDay = view.net_of_day;
  const fundedTotal = view.funded_total;

  const dayCosts = costs.filter((c) => c.cost_date === date);
  const dayTxs = txs.filter((t) => t.tx_date === date);
  const dayMovements = movements.filter((m) => m.move_date === date);
  const dayFundingAll = funding.filter((f) => f.event_date === date);

  const openProblems = problems.filter((p) => p.status !== "fixed");
  const subs = subscriptions(costs);

  const { config } = useDeadlineConfig();
  const totals = grandTotals(date, moneyCtx, rows);
  const status = statusRows(date, config, { costs, vpsList, accounts });

  const dayWithdrawals = dayFundingAll.filter((f) => f.kind === "withdraw");
  const dayDeposits = dayFundingAll.filter((f) => f.kind === "deposit");
  const dayRedeposits = dayFundingAll.filter((f) => f.kind === "redeposit");

  const history = useMemo(
    () =>
      [...logs]
        .sort((a, b) => (a.log_date < b.log_date ? 1 : a.log_date > b.log_date ? -1 : 0))
        .slice(0, 80),
    [logs],
  );

  const theory = [
    stored
      ? `This day was closed on ${new Date(day!.closed_at ?? "").toLocaleString()}, so the figures below are the stored totals of that moment.`
      : day?.status === "open"
        ? "This day is still open, so the figures below are calculated live from the data stored so far."
        : "This day was never opened, so the figures below are calculated live from whatever is recorded for the date.",
    `Active accounts opened at ${money(totals.activeOpening)} and closed at ${money(totals.activeClosing)}; reserve accounts ${money(totals.reserveOpening)} → ${money(totals.reserveClosing)}; Binance ${money(totals.binanceOpening)} → ${money(totals.binanceClosing)}.`,
    `Adding the three groups gives a grand opening of ${money(totals.grandOpening)} and a grand closing of ${money(totals.grandClosing)}, so by subtraction the net is ${totals.net.toFixed(2)}.`,
    `Grand opening ${money(grandOpening)} to grand closing ${money(grandClosing)} gives a trading net of ${tradingNet.toFixed(2)}.`,
    `Costs of ${money(costTotal)} and transfers sent of ${money(sent)} are taken off, transfers received of ${money(received)} are added back.`,
    `Net of the day: ${netOfDay.toFixed(2)}.`,
    ...moneyTheory(date, date, moneyCtx),
    `Subscriptions bought on ${date}: ${status.boughtToday.length}; subscriptions still running: ${status.running.length}.`,
    ...status.running.map((s) => `${s.purpose} — ${s.label}: ${subscriptionText(s)}.`),
    ...status.vpsRows.map((v) => `VPS ${v.name} deadline ${v.endDate} — ${statusText(v.daysLeft, v.expired)}.`),
    ...status.accountRows.map(
      (a) => `Account ${a.label} deadline ${a.endDate} — ${statusText(a.daysLeft, a.expired)}.`,
    ),
    `Open problems: ${openProblems.length}.`,
    `Subscriptions tracked: ${subs.length}, of which ${subs.filter((x) => x.due).length} are at or past their alert window.`,
  ];



  const sheets: Sheet[] = [
    grandTotalSheet(date, totals),
    ...statusSheets(date, status, problems),
    {

      title: `Per-account balances — ${date}`,
      columns: ["Account", "Status", "Opening", "Closing", "P/L", "Funded today", "Note"],
      rows: [
        ...rows.map((r) => [
          r.label,
          r.status,
          r.opening ?? "",
          r.closing ?? "",
          r.pl ?? "",
          r.deposits,
          r.note ?? "",
        ]),
        [
          "GRAND TOTAL",
          "",
          grandOpening,
          grandClosing,
          Number(tradingNet.toFixed(2)),
          fundedTotal,
          "",
        ],
      ],
    },
    {
      title: "Daily log history",
      columns: ["Date", "Account", "Opening", "Closing", "P/L", "Note"],
      rows: history.map((l) => {
        const o = l.opening_balance == null ? null : Number(l.opening_balance);
        const c = l.closing_balance == null ? null : Number(l.closing_balance);
        return [
          l.log_date,
          accountLabel(l.account_id),
          o ?? "",
          c ?? "",
          o != null && c != null ? Number((c - o).toFixed(2)) : "",
          l.note ?? "",
        ];
      }),
    },
    ...moneySheets(date, date, date, moneyCtx),
    {
      title: "Subscriptions & deadlines",
      columns: ["Purpose", "Details", "Amount", "Started", "Deadline", "Time left"],
      rows: subs.map((x) => [
        x.purpose,
        x.label,
        x.amount,
        x.startsOn,
        x.endsAt.toLocaleString(),
        subscriptionText(x),
      ]),
    },
    {
      title: "Transfers today",
      columns: ["Direction", "Wallet", "Reason", "Amount"],
      rows: dayTxs.length
        ? dayTxs.map((t) => [
            t.direction,
            walletName(t.payment_source_id),
            t.reason ?? "",
            Number(t.amount),
          ])
        : [["No transfer in or out on this date.", "", "", ""]],
    },
    {
      title: "Problems",
      columns: ["Title", "Status", "Action taken", "Solved on", "Details"],
      rows: problems.map((p) => [
        p.title,
        p.status,
        p.action_note ?? "",
        p.solved_on ?? "",
        p.details ?? "",
      ]),
    },
  ];

  const weekSheets: Sheet[] = week
    ? [
        {
          title: `Week ${week.from} → ${week.to} — day by day`,
          columns: [
            "Date",
            "Grand opening",
            "Grand closing",
            "Trading net",
            "Deposits",
            "Withdrawals",
            "Costs",
            "Net of day",
          ],
          rows: [
            ...week.days.map((d) => [
              d.date,
              d.snapshot.grand_opening,
              d.snapshot.grand_closing,
              Number(d.snapshot.trading_net.toFixed(2)),
              d.snapshot.funded_total,
              d.snapshot.withdrawn_total ?? 0,
              d.snapshot.cost_total,
              Number(d.snapshot.net_of_day.toFixed(2)),
            ]),
            [
              "WEEK TOTAL",
              week.grandOpening,
              week.grandClosing,
              Number(week.tradingNet.toFixed(2)),
              week.fundedTotal,
              week.withdrawnTotal,
              week.costTotal,
              Number(week.netOfWeek.toFixed(2)),
            ],
          ],
        },
        {
          title: "Per account — first day opening vs last day closing",
          columns: ["Account", "First day opening", "Last day closing", "Change"],
          rows: week.accountOpenings.map((r) => [
            r.label,
            r.firstOpening ?? "",
            r.lastClosing ?? "",
            r.firstOpening != null && r.lastClosing != null
              ? Number((r.lastClosing - r.firstOpening).toFixed(2))
              : "",
          ]),
        },
        {
          title: "Actions this week",
          columns: ["What", "Detail"],
          rows: [
            ["Problems solved", String(week.problemsSolved.length)],
            ...week.problemsSolved.map((p) => [p.title, p.action_note ?? "solved"]),
            ["Problems still open", String(week.problemsOpen.length)],
            ["Costs paid", String(week.weekCosts.length)],
            ...week.weekCosts.map((c) => [c.reason, String(Number(c.amount))]),
            ["Subscriptions paid", String(week.subscriptionCosts.length)],
            ["VPS in use", String(week.vpsUsed)],
          ],
        },
        ...moneySheets(week.from, week.to, `${week.from} → ${week.to}`, moneyCtx),
      ]
    : [];

  const weekTheory = week
    ? [
        `Week from ${week.from} to ${week.to}.`,
        `First recorded day ${week.firstDate ?? "—"} opened the week at ${money(week.firstOpening)}; last recorded day ${week.lastDate ?? "—"} ended it at ${money(week.lastClosing)}, a change of ${week.weekChange.toFixed(2)}.`,
        `Trading net across the week ${week.tradingNet.toFixed(2)}, costs ${money(week.costTotal)}, transfers sent ${money(week.sent)}, received ${money(week.received)} — net of the week ${week.netOfWeek.toFixed(2)}.`,
        ...moneyTheory(week.from, week.to, moneyCtx),
        `${week.problemsSolved.length} problems solved, ${week.problemsOpen.length} still open, ${week.subscriptionCosts.length} subscriptions paid, ${week.vpsUsed} VPS in use.`,
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Report"
        subtitle="Opening and closing balances, grand totals, net of the day and the theory behind it."
        actions={
          <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="report-date" className="text-xs text-muted-foreground">
                  Report date
                </Label>
                <Input
                  id="report-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <DayControl date={date} />
              <ReportExport
                heading={`Daily report — ${date}`}
                fileBase={`report-${date}`}
                sheets={sheets}
                theory={theory}
              />
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Weekly report</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick the first and last day of the records, generate the week, preview it below, then
            export or send it.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="week-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="week-from"
                type="date"
                value={weekFrom}
                onChange={(e) => setWeekFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label htmlFor="week-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="week-to"
                type="date"
                value={weekTo}
                onChange={(e) => setWeekTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={generateWeek} disabled={!weekFrom || !weekTo || weekFrom > weekTo}>
              Generate weekly report
            </Button>
            {week && (
              <ReportExport
                heading={`Weekly report — ${week.from} to ${week.to}`}
                fileBase={`weekly-report-${week.from}_${week.to}`}
                sheets={weekSheets}
                theory={weekTheory}
              />
            )}
          </div>
        </CardHeader>
        {week && (
          <CardContent className="space-y-6 p-0 pb-6">
            <div className="grid gap-3 px-6 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label={`First day opening (${week.firstDate ?? "—"})`}
                value={money(week.firstOpening)}
              />
              <SummaryCard
                label={`Last day closing (${week.lastDate ?? "—"})`}
                value={money(week.lastClosing)}
              />
              <SummaryCard
                label="Week change"
                value={`${week.weekChange >= 0 ? "+" : ""}${week.weekChange.toFixed(2)}`}
                tone={week.weekChange >= 0 ? "up" : "down"}
              />
              <SummaryCard
                label="Net of the week"
                value={`${week.netOfWeek >= 0 ? "+" : ""}${week.netOfWeek.toFixed(2)}`}
                tone={week.netOfWeek >= 0 ? "up" : "down"}
              />
            </div>

            <div>
              <p className="px-6 pb-2 text-sm font-medium">Day by day</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Grand opening</TableHead>
                    <TableHead className="text-right">Grand closing</TableHead>
                    <TableHead className="text-right">Trading net</TableHead>
                    <TableHead className="text-right">Deposits</TableHead>
                    <TableHead className="text-right">Withdrawals</TableHead>
                    <TableHead className="text-right">Costs</TableHead>
                    <TableHead className="text-right">Net of day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {week.days.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-mono text-xs">{d.date}</TableCell>
                      <TableCell className="text-right font-mono">
                        {money(d.snapshot.grand_opening)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money(d.snapshot.grand_closing)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.snapshot.trading_net.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money(d.snapshot.funded_total)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money(d.snapshot.withdrawn_total ?? 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money(d.snapshot.cost_total)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.snapshot.net_of_day.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Week total</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {money(week.grandOpening)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {money(week.grandClosing)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {week.tradingNet.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {money(week.fundedTotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {money(week.withdrawnTotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {money(week.costTotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {week.netOfWeek.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <div>
              <p className="px-6 pb-2 text-sm font-medium">
                Per account — first day opening vs last day closing
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">First day opening</TableHead>
                    <TableHead className="text-right">Last day closing</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {week.accountOpenings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        Nothing recorded in this range.
                      </TableCell>
                    </TableRow>
                  )}
                  {week.accountOpenings.map((r) => {
                    const change =
                      r.firstOpening != null && r.lastClosing != null
                        ? r.lastClosing - r.firstOpening
                        : null;
                    return (
                      <TableRow key={r.label}>
                        <TableCell className="font-medium">{r.label}</TableCell>
                        <TableCell className="text-right font-mono">
                          {money(r.firstOpening)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {money(r.lastClosing)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {change === null ? (
                            "\u2014"
                          ) : (
                            <span className={change >= 0 ? "text-primary" : "text-destructive"}>
                              {change >= 0 ? "+" : ""}
                              {change.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="px-6">
              <p className="pb-2 text-sm font-medium">Actions & theory of the week</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Badge variant="outline" className="justify-start">
                  {week.problemsSolved.length} problems solved
                </Badge>
                <Badge variant="outline" className="justify-start">
                  {week.problemsOpen.length} problems still open
                </Badge>
                <Badge variant="outline" className="justify-start">
                  {week.subscriptionCosts.length} subscriptions paid
                </Badge>
                <Badge variant="outline" className="justify-start">
                  {week.vpsUsed} VPS in use
                </Badge>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {weekTheory.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Grand opening balance" value={money(grandOpening)} />
        <SummaryCard label="Grand closing balance" value={money(grandClosing)} />
        <SummaryCard
          label="Trading net (closing − opening)"
          value={`${tradingNet >= 0 ? "+" : ""}${tradingNet.toFixed(2)}`}
          tone={tradingNet >= 0 ? "up" : "down"}
        />
        <SummaryCard
          label="Net of the day (after cost & transfers)"
          value={`${netOfDay >= 0 ? "+" : ""}${netOfDay.toFixed(2)}`}
          tone={netOfDay >= 0 ? "up" : "down"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Grand totals — {date}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Active accounts, reserve accounts and the Binance wallet added together; the net is the
            closing minus the opening.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Closing</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: "Active accounts", o: totals.activeOpening, c: totals.activeClosing },
                { label: "Reserve accounts", o: totals.reserveOpening, c: totals.reserveClosing },
                { label: "Binance wallet", o: totals.binanceOpening, c: totals.binanceClosing },
              ].map((g) => (
                <TableRow key={g.label}>
                  <TableCell className="font-medium">{g.label}</TableCell>
                  <TableCell className="text-right font-mono">{money(g.o)}</TableCell>
                  <TableCell className="text-right font-mono">{money(g.c)}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={g.c - g.o >= 0 ? "text-primary" : "text-destructive"}>
                      {g.c - g.o >= 0 ? "+" : ""}
                      {(g.c - g.o).toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Grand total</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(totals.grandOpening)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(totals.grandClosing)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {totals.net >= 0 ? "+" : ""}
                  {totals.net.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Subscriptions & deadlines — {date}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <TheoryTable
            title={`Subscriptions bought on ${date}`}
            empty="No subscription was bought on this date."
            rows={status.boughtToday.map((s) => ({
              id: s.id,
              left: `${s.purpose} — ${s.label}`,
              mid: `${s.startsOn} → ${s.endsAt.toLocaleString()} · ${subscriptionText(s)}`,
              amount: -s.amount,
            }))}
          />
          <TheoryTable
            title="Subscriptions still running"
            empty="No other subscription is running."
            rows={status.running.map((s) => ({
              id: s.id,
              left: `${s.purpose} — ${s.label}`,
              mid: `ends ${s.endsAt.toLocaleString()} · ${subscriptionText(s)}`,
              amount: -s.amount,
            }))}
          />
          <TheoryTable
            title="VPS deadlines"
            empty="No VPS has a purchase date, so no deadline can be counted."
            rows={status.vpsRows.map((v) => ({
              id: v.name,
              left: v.name,
              mid: `${v.endDate} · ${statusText(v.daysLeft, v.expired)}`,
              amount: null,
            }))}
          />
          <TheoryTable
            title="Account deadlines"
            empty="No active account has an activation date, so no deadline can be counted."
            rows={status.accountRows.map((a) => ({
              id: a.label,
              left: a.label,
              mid: `${a.endDate} · ${statusText(a.daysLeft, a.expired)}`,
              amount: null,
            }))}
          />
        </CardContent>
      </Card>



      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Per-account balances — {date}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Individual opening</TableHead>
                <TableHead className="text-right">Individual closing</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead className="text-right">Funded today</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nothing recorded for this date.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="font-medium">
                    {r.label}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{money(r.opening)}</TableCell>
                  <TableCell className="text-right font-mono">{money(r.closing)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.pl === null ? (
                      "—"
                    ) : (
                      <span className={r.pl >= 0 ? "text-primary" : "text-destructive"}>
                        {r.pl >= 0 ? "+" : ""}
                        {r.pl.toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {r.deposits > 0 ? money(r.deposits) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                    {r.note ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Grand total
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(grandOpening)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(grandClosing)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {tradingNet >= 0 ? "+" : ""}
                  {tradingNet.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(fundedTotal)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Daily log history</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every saved day across all accounts, newest first.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Closing</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No daily log saved yet.
                  </TableCell>
                </TableRow>
              )}
              {history.map((l) => {
                const o = l.opening_balance == null ? null : Number(l.opening_balance);
                const c = l.closing_balance == null ? null : Number(l.closing_balance);
                const pl = o != null && c != null ? c - o : null;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.log_date}</TableCell>
                    <TableCell className="font-medium">{accountLabel(l.account_id)}</TableCell>
                    <TableCell className="text-right font-mono">{money(o)}</TableCell>
                    <TableCell className="text-right font-mono">{money(c)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {pl === null ? (
                        "\u2014"
                      ) : (
                        <span className={pl >= 0 ? "text-primary" : "text-destructive"}>
                          {pl >= 0 ? "+" : ""}
                          {pl.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                      {l.note ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Problems</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pending, action taken and fixed problems with their notes.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Problem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action taken</TableHead>
                <TableHead>Solved on</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No problem recorded.
                  </TableCell>
                </TableRow>
              )}
              {problems.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.title}</div>
                    {p.details && (
                      <div className="text-xs text-muted-foreground">{p.details}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "fixed" ? "secondary" : "outline"}>
                      {p.status === "action" ? "Take action" : p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[18rem] text-xs text-muted-foreground">
                    {p.action_note ?? "\u2014"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.solved_on ?? "\u2014"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Theory of the day</CardTitle>
          <p className="text-sm text-muted-foreground">
            Grand opening {money(grandOpening)} → grand closing {money(grandClosing)} gives a
            trading net of {tradingNet.toFixed(2)}. Costs of {money(costTotal)} and transfers sent
            of {money(sent)} are taken off, transfers received of {money(received)} are added back,
            leaving a net of the day of {netOfDay.toFixed(2)}.{" "}
            {dayMovements.length
              ? `Movements of ${money(movedTotal)} only relocate money between accounts, so they do not change the net.`
              : "No movement is listed because no balance was shifted from one account to another on this date."}{" "}
            {binanceDay
              ? `Binance last closed at ${binanceDay.closing.toFixed(2)}.`
              : "No Binance wallet is recorded, so no Binance closing balance is shown."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <TheoryTable
            title="Costs"
            empty="No cost today."
            rows={dayCosts.map((c) => ({
              id: c.id,
              left: c.reason,
              mid: walletName(c.payment_source_id),
              amount: -Number(c.amount),
            }))}
          />
          <TheoryTable
            title="Transfers"
            empty="No transfer today."
            rows={dayTxs.map((t) => ({
              id: t.id,
              left: t.direction === "sent" ? "Sent out" : "Received",
              mid: `${walletName(t.payment_source_id)}${t.reason ? ` — ${t.reason}` : ""}`,
              amount: t.direction === "sent" ? -Number(t.amount) : Number(t.amount),
            }))}
          />
          <TheoryTable
            title="Movements"
            empty="No movement today."
            rows={dayMovements.map((m) => ({
              id: m.id,
              left: `${accountLabel(m.from_account_id)} → ${accountLabel(m.to_account_id)}`,
              mid: `via ${walletName(m.payment_source_id)}${
                Number(m.extra_amount) > 0 ? ` + ${money(m.extra_amount)} extra` : ""
              } · opening ${money(m.to_balance_after)}`,
              amount: Number(m.deposit_amount ?? 0),
            }))}
          />
          <TheoryTable
            title="Subscriptions"
            empty="No subscription recorded."
            rows={subs.map((x) => ({
              id: x.id,
              left: `${x.purpose} — ${x.label}`,
              mid: `${x.endsAt.toLocaleString()} · ${subscriptionText(x)}`,
              amount: -x.amount,
            }))}
          />
          <TheoryTable
            title="Open problems"
            empty="No open problem."
            rows={openProblems.map((p) => ({
              id: p.id,
              left: p.title,
              mid: p.status === "action" ? "Take action" : "Pending",
              amount: null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            tone === "up" ? "text-primary" : tone === "down" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function TheoryTable({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; left: string; mid: string; amount: number | null }[];
}) {
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium">{title}</p>
        {rows.some((r) => r.amount !== null) && (
          <p className="font-mono text-sm">
            {total >= 0 ? "+" : "-"}
            {Math.abs(total).toFixed(2)}
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Table>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{r.left}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.mid}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.amount === null
                    ? "—"
                    : `${r.amount >= 0 ? "+" : "-"}${Math.abs(r.amount).toFixed(2)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
