import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { ReportExport } from "@/components/ReportExport";
import { useDeleteRow, useSaveRow, useTable, useWipeAll, type SavedReport } from "@/lib/db";
import type { Sheet } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({
    meta: [
      { title: "Report Records — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Every saved monthly, weekly and daily report, grouped from the biggest period down, ready to rename or export again.",
      },
      { property: "og:title", content: "Report Records — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Saved monthly, weekly and daily reports you can rename and export again.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordsPage,
});

const KINDS = [
  { key: "monthly", label: "Monthly summary" },
  { key: "weekly", label: "Weekly reports" },
  { key: "daily", label: "Daily reports" },
] as const;

const monthKey = (d: string) => d.slice(0, 7);
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

function RecordsPage() {
  const { data: reports = [] } = useTable<SavedReport>("saved_reports", "created_at", false);
  const rename = useSaveRow("saved_reports");
  const remove = useDeleteRow("saved_reports");
  const wipe = useWipeAll();

  const [editing, setEditing] = useState<SavedReport | null>(null);
  const [name, setName] = useState("");

  const grouped = useMemo(
    () =>
      KINDS.map((k) => ({
        ...k,
        items: reports
          .filter((r) => r.kind === k.key)
          .sort((a, b) => (a.from_date < b.from_date ? 1 : -1)),
      })),
    [reports],
  );

  return (
    <div>
      <PageHeader
        title="Report records"
        subtitle="Saved reports from the biggest period down: monthly, then weekly, then daily."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved reports ({reports.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No report saved yet. Generate one on the Report page and press “Save report”.
            </p>
          ) : (
            <Accordion type="multiple" defaultValue={["monthly", "weekly", "daily"]}>
              {grouped.map((g) => (
                <AccordionItem key={g.key} value={g.key}>
                  <AccordionTrigger>
                    {g.label} ({g.items.length})
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {g.items.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nothing saved in this group.</p>
                    )}
                    {g.items.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                      >
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.from_date} → {r.to_date} · saved{" "}
                            {new Date(r.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{r.kind}</Badge>
                          <ReportExport
                            heading={r.heading}
                            fileBase={r.name.replace(/[^\w-]+/g, "-").toLowerCase()}
                            sheets={(r.sheets ?? []) as Sheet[]}
                            theory={(r.theory ?? []) as string[]}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Rename report"
                            onClick={() => {
                              setEditing(r);
                              setName(r.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete report"
                            onClick={() => {
                              if (confirm(`Delete “${r.name}”?`)) remove.mutate(r.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Clear everything</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Removes every record you have: servers, accounts, bots, logs, costs, transfers,
            problems, wallets and saved reports. This cannot be undone.
          </p>
          <Button
            variant="destructive"
            disabled={wipe.isPending}
            onClick={() => {
              if (prompt("Type DELETE to erase all your records.") === "DELETE") wipe.mutate();
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {wipe.isPending ? "Deleting..." : "Delete all data"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename report</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Report name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!name.trim()) {
                  toast.error("Type a name.");
                  return;
                }
                rename.mutate({ id: editing!.id, name: name.trim() });
                setEditing(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
