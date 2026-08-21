import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Wallet, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { subscriptions, subscriptionText } from "@/lib/alerts";
import { RecordDialog, type FieldSpec } from "@/components/RecordDialog";
import {
  money,
  today,
  useDeleteRow,
  useSaveRow,
  useTable,
  type Cost,
  type Named,
  type Row,
  type Vps,
} from "@/lib/db";

const SUGGESTED_PURPOSES = ["VPS", "Extra login", "Software"];

export const Route = createFileRoute("/_authenticated/costs")({
  component: CostsPage,
});

function CostsPage() {
  const { data: costs = [] } = useTable<Cost>("costs", "cost_date", false);
  const { data: sources = [] } = useTable<Named>("payment_sources", "name", true);
  const { data: servers = [] } = useTable<Vps>("vps");
  const { data: purposes = [] } = useTable<Named>("cost_purposes", "name", true);
  const savePurpose = useSaveRow("cost_purposes");
  const delPurpose = useDeleteRow("cost_purposes");
  const saveCost = useSaveRow("costs");
  const delCost = useDeleteRow("costs");
  const saveSource = useSaveRow("payment_sources");
  const delSource = useDeleteRow("payment_sources");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [srcOpen, setSrcOpen] = useState(false);
  const [srcEditing, setSrcEditing] = useState<Row | null>(null);
  const [purposeOpen, setPurposeOpen] = useState(false);

  const sourceFields: FieldSpec[] = [
    { name: "name", label: "Wallet name", required: true },
    { name: "starting_balance", label: "Starting balance", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const fields: FieldSpec[] = [
    { name: "cost_date", label: "Date", type: "date", required: true },
    { name: "amount", label: "Amount", type: "number", required: true },
    {
      name: "purpose",
      label: "What for",
      type: "select",
      options: (() => {
        const names = purposes.map((p) => p.name);
        const current = editing?.["purpose"];
        if (typeof current === "string" && current && !names.includes(current)) names.push(current);
        return names.map((n) => ({ value: n, label: n }));
      })(),
    },
    { name: "reason", label: "Reason / details", required: true, full: true },
    {
      name: "is_subscription",
      label: "Has a deadline (subscription)",
      type: "select",
      options: [
        { value: "yes", label: "Yes — remind me" },
        { value: "no", label: "No — one-off cost" },
      ],
    },
    { name: "starts_on", label: "Paid / starts on", type: "date" },
    { name: "duration_value", label: "Paid for (amount of time)", type: "number" },
    {
      name: "duration_unit",
      label: "Unit",
      type: "select",
      options: [
        { value: "hour", label: "Hours" },
        { value: "day", label: "Days" },
        { value: "week", label: "Weeks" },
        { value: "month", label: "Months" },
      ],
    },
    {
      name: "notify_before_hours",
      label: "Alert me this many hours before",
      type: "number",
      placeholder: "24",
    },
    {
      name: "payment_source_id",
      label: "Paid from",
      type: "select",
      options: sources
        .filter((s) => s.is_active !== false)
        .map((s) => ({ value: s.id, label: s.name })),
    },
    {
      name: "vps_id",
      label: "Related VPS",
      type: "select",
      options: servers.map((v) => ({ value: v.id, label: v.name })),
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const subs = subscriptions(costs);
  const total = costs.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div>
      <PageHeader
        title="Costs"
        subtitle="Every expense and which wallet paid for it."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPurposeOpen(true)}>
              <Tag className="mr-1 h-4 w-4" /> Add purpose
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSrcEditing(null);
                setSrcOpen(true);
              }}
            >
              <Wallet className="mr-1 h-4 w-4" /> Add payment source
            </Button>
            <Button
              onClick={() => {
                setEditing({
                  cost_date: today(),
                  starts_on: today(),
                  is_subscription: "no",
                  duration_unit: "day",
                  notify_before_hours: 24,
                });
                setOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add cost
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">All costs</CardTitle>
            <span className="text-sm text-muted-foreground">Total {money(total)}</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid from</TableHead>
                  <TableHead>VPS</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No costs recorded.
                    </TableCell>
                  </TableRow>
                )}
                {costs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.cost_date}</TableCell>
                    <TableCell className="text-xs">{c.purpose ?? "\u2014"}</TableCell>
                    <TableCell className="font-medium">{c.reason}</TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        const s = subs.find((x) => x.id === c.id);
                        if (!s) return "\u2014";
                        return (
                          <Badge variant={s.due ? "destructive" : "outline"}>
                            {s.endsAt.toLocaleString()} · {subscriptionText(s)}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{money(c.amount)}</TableCell>
                    <TableCell className="text-xs">
                      {sources.find((s) => s.id === c.payment_source_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {servers.find((v) => v.id === c.vps_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing({ ...c, is_subscription: c.is_subscription ? "yes" : "no" });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => delCost.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost purposes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              This list is the "What for" dropdown. Add or remove anything you like.
            </p>
            {purposes.length === 0 && (
              <p className="text-sm text-muted-foreground">No purposes yet — add one below.</p>
            )}
            {purposes.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                {p.name}
                <Button size="icon" variant="ghost" onClick={() => delPurpose.mutate(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTED_PURPOSES.filter((s) => !purposes.some((p) => p.name === s)).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  onClick={() => savePurpose.mutate({ name: s })}
                >
                  <Plus className="mr-1 h-3 w-3" /> {s}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => setPurposeOpen(true)}
            >
              <Tag className="mr-1 h-4 w-4" /> Add custom purpose
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sources.length === 0 && (
              <p className="text-sm text-muted-foreground">Add Binance or any wallet you pay from.</p>
            )}
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">
                  {s.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    start {money(s.starting_balance)}
                  </span>
                </span>
                <div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setSrcEditing(s);
                      setSrcOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => delSource.mutate(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        </div>
      </div>

      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.["id"] ? "Edit cost" : "Add cost"}
        fields={fields}
        initial={editing}
        onSubmit={(v) => {
          saveCost.mutate({
            ...v,
            is_subscription: v["is_subscription"] === "yes",
            duration_unit: v["duration_unit"] ?? "day",
            notify_before_hours: v["notify_before_hours"] ?? 24,
          });
          setOpen(false);
        }}
      />
      <RecordDialog
        open={purposeOpen}
        onOpenChange={setPurposeOpen}
        title="Add cost purpose"
        description="For example VPS, extra login, domain — anything you pay for."
        fields={[{ name: "name", label: "Purpose name", required: true, full: true }]}
        onSubmit={(v) => {
          savePurpose.mutate(v);
          setPurposeOpen(false);
        }}
      />
      <RecordDialog
        open={srcOpen}
        onOpenChange={setSrcOpen}
        title={srcEditing?.["id"] ? "Edit payment source" : "Add payment source"}
        fields={sourceFields}
        initial={srcEditing}
        onSubmit={(v) => {
          saveSource.mutate(v);
          setSrcOpen(false);
        }}
      />
    </div>
  );
}
