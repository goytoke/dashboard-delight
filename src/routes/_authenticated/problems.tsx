import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, Hammer, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { RecordDialog, type FieldSpec } from "@/components/RecordDialog";
import { today, useDeleteRow, useSaveRow, useTable, type Problem } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/problems")({
  head: () => ({
    meta: [
      { title: "Problems — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Log every operational problem, move it to take action, then mark it fixed once solved.",
      },
      { property: "og:title", content: "Problems — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Pending, take action and fixed panels for every issue in your bot operation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProblemsPage,
});

const fields: FieldSpec[] = [
  { name: "title", label: "Problem", required: true, full: true },
  { name: "details", label: "Details", type: "textarea" },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { value: "pending", label: "Pending" },
      { value: "action", label: "Take action" },
      { value: "fixed", label: "Fixed" },
    ],
  },
  { name: "action_note", label: "Action taken", type: "textarea" },
];

const PANELS = [
  {
    key: "pending" as const,
    title: "Pending",
    icon: Clock,
    tone: "border-border",
    hint: "Just reported, nothing started yet.",
  },
  {
    key: "action" as const,
    title: "Take action",
    icon: Hammer,
    tone: "border-primary/40",
    hint: "Being worked on right now.",
  },
  {
    key: "fixed" as const,
    title: "Fixed",
    icon: CheckCircle2,
    tone: "border-primary/60",
    hint: "Solved and closed.",
  },
];

function ProblemsPage() {
  const { data: problems = [] } = useTable<Problem>("problems");
  const save = useSaveRow("problems");
  const del = useDeleteRow("problems");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Problem | null>(null);

  const setStatus = (p: Problem, status: Problem["status"]) =>
    save.mutate({
      id: p.id,
      status,
      solved_on: status === "fixed" ? today() : null,
    });

  return (
    <div>
      <PageHeader
        title="Problems"
        subtitle="Report an issue, take action on it, then mark it fixed."
        actions={
          <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add problem
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {PANELS.map((panel) => {
          const rows = problems.filter((p) => p.status === panel.key);
          return (
            <Card key={panel.key} className={panel.tone}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <panel.icon className="h-4 w-4" />
                  {panel.title}
                  <Badge variant="outline" className="ml-auto">
                    {rows.length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{panel.hint}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {rows.length === 0 && (
                  <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Nothing here.
                  </p>
                )}
                {rows.map((p) => (
                  <div key={p.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="text-left text-sm font-medium hover:underline"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          {p.title}
                        </button>
                        {p.details ? (
                          <p className="mt-1 text-xs text-muted-foreground">{p.details}</p>
                        ) : null}
                        {p.action_note ? (
                          <p className="mt-1 text-xs">
                            <span className="text-muted-foreground">Action: </span>
                            {p.action_note}
                          </p>
                        ) : null}
                        {p.solved_on ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Fixed on {p.solved_on}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete problem"
                        onClick={() => del.mutate(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {panel.key !== "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(p, "pending")}>
                          Pending
                        </Button>
                      )}
                      {panel.key !== "action" && (
                        <Button size="sm" variant="secondary" onClick={() => setStatus(p, "action")}>
                          Take action
                        </Button>
                      )}
                      {panel.key !== "fixed" && (
                        <Button size="sm" onClick={() => setStatus(p, "fixed")}>
                          Fixed
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit problem" : "Add problem"}
        description="Describe what went wrong and where it stands."
        fields={fields}
        initial={editing ?? { status: "pending" }}
        onSubmit={(v) => {
          save.mutate({ ...v, solved_on: v["status"] === "fixed" ? today() : null });
          setOpen(false);
        }}
      />
    </div>
  );
}
