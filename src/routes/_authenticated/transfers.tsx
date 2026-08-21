import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, UserPlus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  money,
  today,
  useDeleteRow,
  useSaveRow,
  useTable,
  type Named,
  type Row,
  type Transaction,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/transfers")({
  component: TransfersPage,
});

function TransfersPage() {
  const { data: txs = [] } = useTable<Transaction>("transactions", "tx_date", false);
  const { data: people = [] } = useTable<Named>("people", "name", true);
  const { data: wallets = [] } = useTable<Named>("payment_sources", "name", true);
  const saveTx = useSaveRow("transactions", ["payment_sources"]);
  const delTx = useDeleteRow("transactions");
  const savePerson = useSaveRow("people");
  const delPerson = useDeleteRow("people");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [personEditing, setPersonEditing] = useState<Row | null>(null);

  const fields: FieldSpec[] = [
    {
      name: "direction",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "sent", label: "Sent" },
        { value: "received", label: "Received" },
      ],
    },
    { name: "amount", label: "Amount", type: "number", required: true },
    {
      name: "person_id",
      label: "To / From",
      type: "select",
      required: true,
      options: people.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      name: "payment_source_id",
      label: "Wallet",
      type: "select",
      options: wallets
        .filter((w) => w.is_active !== false)
        .map((w) => ({ value: w.id, label: w.name })),
    },
    { name: "tx_date", label: "Date", type: "date", required: true },
    { name: "reason", label: "Reason", type: "textarea" },
  ];

  const list = (dir: "sent" | "received") => txs.filter((t) => t.direction === dir);
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? "—";

  const TxTable = ({ dir }: { dir: "sent" | "received" }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>{dir === "sent" ? "Sent to" : "Received from"}</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list(dir).length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
              Nothing recorded.
            </TableCell>
          </TableRow>
        )}
        {list(dir).map((t) => (
          <TableRow key={t.id}>
            <TableCell>{t.tx_date}</TableCell>
            <TableCell className="font-medium">{money(t.amount)}</TableCell>
            <TableCell>{nameOf(t.person_id)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{t.reason ?? "—"}</TableCell>
            <TableCell className="text-right">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(t);
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => delTx.mutate(t.id)}>
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
        title="Transfers"
        subtitle="Money sent and received, tracked per person."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPersonEditing(null);
                setPersonOpen(true);
              }}
            >
              <UserPlus className="mr-1 h-4 w-4" /> Add person
            </Button>
            <Button
              disabled={people.length === 0}
              onClick={() => {
                setEditing({ tx_date: today(), direction: "sent" });
                setOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add transaction
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="sent">
              <div className="p-3">
                <TabsList>
                  <TabsTrigger value="sent">
                    <ArrowUpRight className="mr-1 h-4 w-4" /> Sent (
                    {money(list("sent").reduce((s, t) => s + Number(t.amount), 0))})
                  </TabsTrigger>
                  <TabsTrigger value="received">
                    <ArrowDownLeft className="mr-1 h-4 w-4" /> Received (
                    {money(list("received").reduce((s, t) => s + Number(t.amount), 0))})
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="sent" className="m-0">
                <TxTable dir="sent" />
              </TabsContent>
              <TabsContent value="received" className="m-0">
                <TxTable dir="received" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">People</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {people.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add a person first, then record transactions.
              </p>
            )}
            {people.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{p.name}</span>
                <div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setPersonEditing(p);
                      setPersonOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => delPerson.mutate(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.["id"] ? "Edit transaction" : "Add transaction"}
        fields={fields}
        initial={editing}
        onSubmit={(v) => {
          saveTx.mutate(v);
          setOpen(false);
        }}
      />
      <RecordDialog
        open={personOpen}
        onOpenChange={setPersonOpen}
        title={personEditing?.["id"] ? "Edit person" : "Add person"}
        fields={[
          { name: "name", label: "Name", required: true, full: true },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        initial={personEditing}
        onSubmit={(v) => {
          savePerson.mutate(v);
          setPersonOpen(false);
        }}
      />
    </div>
  );
}
