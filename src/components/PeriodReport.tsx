import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ReportExport } from "@/components/ReportExport";
import { SaveReportDialog, type ReportKind } from "@/components/SaveReportDialog";
import { computeWeek, type WeekData, type WeekReport } from "@/lib/week";
import { money, type DayResult } from "@/lib/db";
import { resultsNetOf } from "@/components/DayResults";
import type { Sheet } from "@/lib/export";
import {
  incomeExpense,
  incomeExpenseSheet,
  moneySheets,
  moneyTheory,
  type MoneyContext,
} from "@/lib/report-sections";

const round = (n: number) => Number(n.toFixed(2));

/**
 * Weekly or monthly report: pick the first and the last day on the small
 * calendars, generate, look at the day by day table, then export or save it
 * under a name. Days with nothing recorded (Saturday, Sunday) are skipped.
 */
export function PeriodReport({
  kind,
  title,
  hint,
  from,
  to,
  data,
  moneyCtx,
  dayResults,
  vpsList = [],
}: {
  kind: ReportKind;
  title: string;
  hint: string;
  from: string;
  to: string;
  data: WeekData;
  moneyCtx: MoneyContext;
  dayResults: DayResult[];
  vpsList?: Vps[];
}) {
  const vpsName = (id: string | null) => vpsList.find((v) => v.id === id)?.name ?? "—";
  const [rangeFrom, setRangeFrom] = useState(from);
  const [rangeTo, setRangeTo] = useState(to);
  const [report, setReport] = useState<WeekReport | null>(null);
  const [label, setLabel] = useState({ from, to });

  const generate = () => {
    setReport(computeWeek(rangeFrom, rangeTo, data));
    setLabel({ from: rangeFrom, to: rangeTo });
  };

  const recorded = (report?.days ?? []).filter((d) =>
    d.snapshot.rows.some((r) => r.opening != null || r.closing != null),
  );

  const results = dayResults.filter(
    (r) => r.result_date >= label.from && r.result_date <= label.to,
  );
  const resultsNet = resultsNetOf(results);
  const ie = report
    ? incomeExpense({
        resultsNet,
        received: report.received,
        costs: report.costTotal,
        sent: report.sent,
        grandOpening: report.firstOpening,
      })
    : null;

  const dayRows = recorded.map((d) => ({
    date: d.date,
    opening: d.snapshot.grand_opening,
    closing: d.snapshot.grand_closing,
    net: d.snapshot.grand_closing - d.snapshot.grand_opening,
  }));

  const periodLabel = `${label.from} → ${label.to}`;

  const sheets: Sheet[] =
    report && ie
      ? [
          {
            title: `${title} — day by day (${periodLabel})`,
            columns: ["Day", "Date", "Grand opening", "Grand closing", "Net (closing − opening)"],
            rows: [
              ...dayRows.map((d, i) => [
                `Day ${i + 1}`,
                d.date,
                round(d.opening),
                round(d.closing),
                round(d.net),
              ]),
              [
                "TOTAL",
                periodLabel,
                round(report.firstOpening),
                round(report.lastClosing),
                round(report.lastClosing - report.firstOpening),
              ],
            ],
          },
          incomeExpenseSheet(periodLabel, ie, report.firstOpening),
          {
            title: `Profit / loss records — ${periodLabel}`,
            columns: ["Date", "VPS", "Label", "Net P/L"],
            rows: results.length
              ? results.map((r) => [
                  r.result_date,
                  vpsName(r.vps_id),
                  r.label ?? "",
                  r.direction === "loss" ? -Number(r.amount) : Number(r.amount),
                ])
              : [["No profit or loss recorded in this period.", "", "", ""]],
          },
          {
            title: `Per account — first day opening vs last day closing (${periodLabel})`,
            columns: ["Account", "First day opening", "Last day closing"],
            rows: report.accountOpenings.map((r) => [
              r.label,
              r.firstOpening ?? "",
              r.lastClosing ?? "",
            ]),
          },
          {
            title: `Actions — ${periodLabel}`,
            columns: ["What", "Detail"],
            rows: [
              ["Problems solved", String(report.problemsSolved.length)],
              ...report.problemsSolved.map((p) => [p.title, p.action_note ?? "solved"]),
              ["Problems still open", String(report.problemsOpen.length)],
              ["Costs paid", String(report.weekCosts.length)],
              ...report.weekCosts.map((c) => [c.reason, String(Number(c.amount))]),
              ["Subscriptions paid", String(report.subscriptionCosts.length)],
              ["VPS in use", String(report.vpsUsed)],
            ],
          },
          ...moneySheets(label.from, label.to, periodLabel, moneyCtx),
        ]
      : [];

  const theory =
    report && ie
      ? [
          `${title} from ${label.from} to ${label.to}, counting only the ${dayRows.length} day(s) that have records — days with nothing saved are left out.`,
          `First recorded day ${report.firstDate ?? "—"} opened at ${money(report.firstOpening)}; last recorded day ${report.lastDate ?? "—"} closed at ${money(report.lastClosing)}, so by subtraction the change is ${(report.lastClosing - report.firstOpening).toFixed(2)}.`,
          `Income ${ie.income.toFixed(2)} (profit/loss recorded ${ie.resultsNet.toFixed(2)} plus transfers received ${ie.received.toFixed(2)}) minus expense ${ie.expense.toFixed(2)} (costs ${ie.costs.toFixed(2)} plus transfers sent ${ie.sent.toFixed(2)}) gives a net of ${ie.net.toFixed(2)}.`,
          `Grand opening ${money(report.firstOpening)} moved by that net gives a grand closing of ${money(ie.projectedClosing)}.`,
          ...moneyTheory(label.from, label.to, moneyCtx),
          `${report.problemsSolved.length} problems solved, ${report.problemsOpen.length} still open, ${report.subscriptionCosts.length} subscriptions paid, ${report.vpsUsed} VPS in use.`,
        ]
      : [];

  return (
    <Card className="mb-6">
      <CardHeader className="gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{hint}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={generate} disabled={!rangeFrom || !rangeTo || rangeFrom > rangeTo}>
            Generate {kind} report
          </Button>
          {report && (
            <>
              <SaveReportDialog
                kind={kind}
                from={label.from}
                to={label.to}
                heading={`${title} — ${periodLabel}`}
                sheets={sheets}
                theory={theory}
                defaultName={`${title} ${label.from} to ${label.to}`}
              />
              <ReportExport
                heading={`${title} — ${periodLabel}`}
                fileBase={`${kind}-report-${label.from}_${label.to}`}
                sheets={sheets}
                theory={theory}
              />
            </>
          )}
        </div>
      </CardHeader>

      {report && ie && (
        <CardContent className="space-y-6 p-0 pb-6">
          <div className="grid gap-3 px-6 sm:grid-cols-2 xl:grid-cols-4">
            <Box label={`First day opening (${report.firstDate ?? "—"})`} value={money(report.firstOpening)} />
            <Box label={`Last day closing (${report.lastDate ?? "—"})`} value={money(report.lastClosing)} />
            <Box
              label="Net by subtraction"
              value={`${report.lastClosing - report.firstOpening >= 0 ? "+" : ""}${(report.lastClosing - report.firstOpening).toFixed(2)}`}
            />
            <Box
              label="Net = income − expense"
              value={`${ie.net >= 0 ? "+" : ""}${ie.net.toFixed(2)}`}
            />
          </div>

          <div>
            <p className="px-6 pb-2 text-sm font-medium">Day by day</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Grand opening</TableHead>
                  <TableHead className="text-right">Grand closing</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No day in this range has any record.
                    </TableCell>
                  </TableRow>
                )}
                {dayRows.map((d, i) => (
                  <TableRow key={d.date}>
                    <TableCell>Day {i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{d.date}</TableCell>
                    <TableCell className="text-right font-mono">{money(d.opening)}</TableCell>
                    <TableCell className="text-right font-mono">{money(d.closing)}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={d.net >= 0 ? "text-primary" : "text-destructive"}>
                        {d.net >= 0 ? "+" : ""}
                        {d.net.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">
                    {periodLabel}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {money(report.firstOpening)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {money(report.lastClosing)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {(report.lastClosing - report.firstOpening).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="px-6">
            <p className="pb-2 text-sm font-medium">Actions & theory</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Badge variant="outline" className="justify-start">
                {report.problemsSolved.length} problems solved
              </Badge>
              <Badge variant="outline" className="justify-start">
                {report.problemsOpen.length} problems still open
              </Badge>
              <Badge variant="outline" className="justify-start">
                {report.subscriptionCosts.length} subscriptions paid
              </Badge>
              <Badge variant="outline" className="justify-start">
                {report.vpsUsed} VPS in use
              </Badge>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {theory.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
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
