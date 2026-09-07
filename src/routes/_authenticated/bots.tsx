import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2, Sparkles, Copy, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { RecordDialog, type FieldSpec } from "@/components/RecordDialog";
import { ReportExport } from "@/components/ReportExport";
import type { Sheet } from "@/lib/export";
import { useDeleteRow, useSaveRow, useTable, type Bot, type Row, type Vps } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/bots")({
  component: BotsPage,
});

function randomMagic(taken: Set<number>) {
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(100000 + Math.random() * 900000);
    if (!taken.has(n)) return n;
  }
  let n = 100000;
  while (taken.has(n)) n += 1;
  return n;
}

function BotsPage() {
  const { data: bots = [] } = useTable<Bot>("bots", "magic_number", true);
  const { data: servers = [] } = useTable<Vps>("vps");
  const save = useSaveRow("bots");
  const del = useDeleteRow("bots");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<number | null>(null);

  const registered = bots.filter((b) => b.status === "registered");
  const pending = bots.filter((b) => b.status === "pending");

  const taken = useMemo(() => new Set(bots.map((b) => Number(b.magic_number))), [bots]);

  const fields: FieldSpec[] = [
    { name: "username", label: "Username" },
    { name: "magic_number", label: "Magic number", type: "number", required: true },
    { name: "email", label: "Email" },
    { name: "password", label: "Password" },
    {
      name: "vps_id",
      label: "VPS",
      type: "select",
      options: servers.map((v) => ({ value: v.id, label: v.name })),
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: [
        { value: "registered", label: "Registered" },
        { value: "pending", label: "Generated (not used yet)" },
      ],
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const generate = () => setDraft(randomMagic(taken));

  const sheet = (title: string, rows: Bot[]): Sheet => ({
    title,
    columns: ["Username", "Magic number", "Email", "Password", "VPS", "Status", "Notes"],
    rows: rows.map((b) => [
      b.username ?? "—",
      b.magic_number,
      b.email ?? "—",
      b.password ?? "—",
      servers.find((v) => v.id === b.vps_id)?.name ?? "—",
      b.status === "registered" ? "Registered" : "Generated (not used)",
      b.notes ?? "—",
    ]),
  });

  const exportSheets: Sheet[] = [
    sheet("Registered bots", registered),
    sheet("Generated, waiting", pending),
  ];

  const copyDraft = () => {
    if (!draft) return;
    void navigator.clipboard.writeText(String(draft));
    toast.success("Copied magic number");
  };

  const finishDraft = () => {
    if (!draft) return;
    save.mutate({ magic_number: draft, status: "pending" });
    setDraft(null);
  };

  const botTable = (rows: Bot[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Magic number</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Password</TableHead>
          <TableHead>VPS</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
              Nothing here yet.
            </TableCell>
          </TableRow>
        )}
        {rows.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.username ?? "—"}</TableCell>
            <TableCell className="font-mono">{b.magic_number}</TableCell>
            <TableCell className="text-xs">{b.email ?? "—"}</TableCell>
            <TableCell className="font-mono text-xs">{b.password ?? "—"}</TableCell>
            <TableCell className="text-xs">
              {servers.find((v) => v.id === b.vps_id)?.name ?? "—"}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              {b.status === "pending" && (
                <Button
                  size="icon"
                  variant="ghost"
                  title="Mark as registered"
                  onClick={() => save.mutate({ id: b.id, status: "registered" })}
                >
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(b);
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(b.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div>
      <PageHeader
        title="Bot Manager"
        subtitle="Registered bots and a generator that never reuses a username or magic number."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReportExport
              heading="Bot Manager"
              fileBase="bot-manager"
              sheets={exportSheets}
              theory={[
                `${registered.length} registered bots, ${pending.length} magic numbers reserved and not used yet.`,
              ]}
            />
            <Button
              onClick={() => {
                setEditing({ status: "registered", magic_number: randomMagic(taken) });
                setOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Register bot
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="registered">
        <TabsList className="mb-4">
          <TabsTrigger value="registered">Registered ({registered.length})</TabsTrigger>
          <TabsTrigger value="generate">Generate ({pending.length} waiting)</TabsTrigger>
        </TabsList>

        <TabsContent value="registered">
          <Card>
            <CardContent className="p-0">{botTable(registered)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generate next identity</CardTitle>
              <CardDescription>
                A random 6-digit magic number, never consecutive and never one you already have.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!draft ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-muted-foreground">Nothing generated yet.</p>
                  <Button onClick={generate}>
                    <Sparkles className="mr-1 h-4 w-4" /> Generate
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Magic number</p>
                    <p className="font-mono text-2xl">{draft}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={copyDraft}>
                      <Copy className="mr-1 h-4 w-4" /> Copy
                    </Button>
                    <Button onClick={finishDraft}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Finished — save it
                    </Button>
                    <Button variant="ghost" onClick={() => setDraft(null)}>
                      Discard
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Generated, waiting to be registered</CardTitle>
              <Badge variant="outline">{pending.length} reserved</Badge>
            </CardHeader>
            <CardContent className="p-0">{botTable(pending)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.["id"] ? "Edit bot" : "Register bot"}
        fields={fields}
        initial={editing}
        onSubmit={(v) => {
          save.mutate(v);
          setOpen(false);
        }}
      />
    </div>
  );
}
