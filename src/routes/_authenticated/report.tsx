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
import { addDays, endOfMonth, startOfMonth, startOfWeek, type WeekData } from "@/lib/week";
import { PeriodReport } from "@/components/PeriodReport";
import { SaveReportDialog } from "@/components/SaveReportDialog";
import { resultsNetOf } from "@/components/DayResults";
import { ReportExport } from "@/components/ReportExport";
import type { Sheet } from "@/lib/export";
import {
  binanceClosing,
  grandTotalSheet,
  grandTotals,
  incomeExpense,
  incomeExpenseSheet,
  moneySheets,
  moneyTheory,
  type MoneyContext,
} from "@/lib/report-sections";
import { statusRows, statusSheets, statusText } from "@/lib/report-status";
import { inventorySheets } from "@/lib/report-inventory";
import { useDeadlineConfig } from "@/lib/settings";

import {
  money,
  today,
  useTable,
  type Account,
  type Bot,
  type Cost,
  type DailyLog,
  type DayResult,
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
  const { data: bots = [] } = useTable<Bot>("bots");

  const { data: dayResults = [] } = useTable<DayResult>("day_results", "created_at", false);

  const periodData: WeekData = {
    accounts,
    logs,
    funding,
    costs,
    transactions: txs,
    movements,
    problems,
    vpsList,
  };

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

  const dayResultRows = dayResults.filter((r) => r.result_date === date);
  const resultsNet = resultsNetOf(dayResultRows);
  const ie = incomeExpense({
    resultsNet,
    received,
    costs: costTotal,
    sent,
    grandOpening: totals.grandOpening,
  });

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
    `Income of ${ie.income.toFixed(2)} = profit/loss recorded ${resultsNet.toFixed(2)} plus transfers received ${received.toFixed(2)}.`,
    `Expense of ${ie.expense.toFixed(2)} = costs ${costTotal.toFixed(2)} (subscriptions, VPS and everything paid) plus transfers sent ${sent.toFixed(2)}, because money sent out is counted as a cost.`,
    `Net = income − expense = ${ie.net.toFixed(2)}, so the grand closing balance is the grand opening ${money(totals.grandOpening)} plus that net = ${money(ie.projectedClosing)}.`,
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
    incomeExpenseSheet(date, ie, totals.grandOpening),
    {
      title: `Profit / loss recorded — ${date}`,
      columns: ["VPS", "Label", "Net P/L"],
      rows: dayResultRows.length
        ? dayResultRows.map((r) => [
            vpsList.find((v) => v.id === r.vps_id)?.name ?? "",
            r.label ?? "",
            r.direction === "loss" ? -Number(r.amount) : Number(r.amount),
          ])
        : [["No profit or loss was recorded on this date.", "", ""]],
    },
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
    ...inventorySheets(date, date, { vpsList, accounts, bots, logs }),
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
              <SaveReportDialog
                kind="daily"
                from={date}
                to={date}
                heading={`Daily report — ${date}`}
                sheets={sheets}
                theory={theory}
                defaultName={`Daily report ${date}`}
              />
              <ReportExport
                heading={`Daily report — ${date}`}
                fileBase={`report-${date}`}
                sheets={sheets}
                theory={theory}
              />
          </div>
        }
      />

      <PeriodReport
        kind="weekly"
        title="Weekly report"
        hint="Pick the first and the last day of the week on the calendars, generate it, then name and save it or export it. Days with no record (Saturday, Sunday) are skipped."
        from={startOfWeek(today())}
        to={addDays(startOfWeek(today()), 6)}
        data={periodData}
        moneyCtx={moneyCtx}
        dayResults={dayResults}
        vpsList={vpsList}
        inventory={{ vpsList, accounts, bots, logs }}
      />

      <PeriodReport
        kind="monthly"
        title="Monthly report"
        hint="Pick the first and the last day of the month, generate it, then name and save it or export it. Only the days that have records are counted."
        from={startOfMonth(today())}
        to={endOfMonth(today())}
        data={periodData}
        moneyCtx={moneyCtx}
        dayResults={dayResults}
        vpsList={vpsList}
        inventory={{ vpsList, accounts, bots, logs }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Grand opening balance" value={money(totals.grandOpening)} />
        <SummaryCard label="Grand closing balance" value={money(totals.grandClosing)} />
        <SummaryCard
          label="Accounts trading net (closing − opening)"
          value={`${tradingNet >= 0 ? "+" : ""}${tradingNet.toFixed(2)}`}
          tone={tradingNet >= 0 ? "up" : "down"}
        />
        <SummaryCard
          label="Net of the day (income − expense)"
          value={`${ie.net >= 0 ? "+" : ""}${ie.net.toFixed(2)}`}
          tone={ie.net >= 0 ? "up" : "down"}
        />
      </div>


      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Grand totals — {date}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Active accounts, reserve accounts and every wallet (Binance included) added together; the
            net is the closing minus the opening.
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
                ...totals.wallets.map((w) => ({
                  label: `Wallet — ${w.name}`,
                  o: w.opening,
                  c: w.closing,
                })),
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
          <CardTitle className="text-base">Income, expense and net — {date}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Income is the profit or loss you recorded plus whatever was received from a transfer.
            Expense is every cost of the day plus whatever was sent to somebody, because money sent
            is a cost. The grand closing balance is the grand opening moved by that net.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { k: "Profit / loss recorded", v: ie.resultsNet },
                { k: "Transfers received", v: ie.received },
                { k: "INCOME", v: ie.income, strong: true },
                { k: "Costs (subscriptions, VPS, everything paid)", v: -ie.costs },
                { k: "Transfers sent (counted as a cost)", v: -ie.sent },
                { k: "EXPENSE", v: -ie.expense, strong: true },
              ].map((r) => (
                <TableRow key={r.k}>
                  <TableCell className={r.strong ? "font-semibold" : ""}>{r.k}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={r.v >= 0 ? "text-primary" : "text-destructive"}>
                      {r.v >= 0 ? "+" : ""}
                      {r.v.toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">NET = income − expense</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {ie.net >= 0 ? "+" : ""}
                  {ie.net.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Grand opening balance</TableCell>
                <TableCell className="text-right font-mono">{money(totals.grandOpening)}</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">
                  Grand closing balance (opening + net)
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {money(ie.projectedClosing)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Profit / loss recorded — {date}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Entries saved on the Daily Log page, per VPS and register number.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VPS</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Net P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayResultRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    No profit or loss was recorded on this date.
                  </TableCell>
                </TableRow>
              )}
              {dayResultRows.map((r) => {
                const signed = r.direction === "loss" ? -Number(r.amount) : Number(r.amount);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{vpsList.find((v) => v.id === r.vps_id)?.name ?? "—"}</TableCell>
                    
                    <TableCell>{r.label ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={signed >= 0 ? "text-primary" : "text-destructive"}>
                        {signed >= 0 ? "+" : ""}
                        {signed.toFixed(2)}
                      </span>
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
            title="Deposits"
            empty="No direct deposit today — no fresh money was pushed from a wallet into an account."
            rows={dayDeposits.map((f) => ({
              id: f.id,
              left: accountLabel(f.account_id),
              mid: `from ${walletName(f.payment_source_id)}${
                f.balance_after != null ? ` · balance after ${money(f.balance_after)}` : ""
              }`,
              amount: Number(f.amount),
            }))}
          />
          <TheoryTable
            title="Redeposits"
            empty="No redeposit today — nothing withdrawn earlier was put back into an account."
            rows={dayRedeposits.map((f) => ({
              id: f.id,
              left: accountLabel(f.account_id),
              mid: `${f.from_account_id ? `from ${accountLabel(f.from_account_id)} · ` : ""}via ${walletName(
                f.payment_source_id,
              )}${f.balance_after != null ? ` · balance after ${money(f.balance_after)}` : ""}`,
              amount: Number(f.amount),
            }))}
          />
          <TheoryTable
            title="Withdrawals"
            empty="No withdrawal today — no money was pulled out of an account into a wallet."
            rows={dayWithdrawals.map((f) => ({
              id: f.id,
              left: accountLabel(f.account_id),
              mid: `into ${walletName(f.payment_source_id)}${
                Number(f.fee ?? 0) > 0 ? ` · fee ${money(f.fee)}` : ""
              }${f.balance_after != null ? ` · balance after ${money(f.balance_after)}` : ""}`,
              amount: -Number(f.amount),
            }))}
          />
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
