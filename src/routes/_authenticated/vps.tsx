import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useDeleteRow, useSaveRow, useTable, type Account, type Row, type Vps } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/vps")({
  component: VpsPage,
});

const fields: FieldSpec[] = [
  { name: "name", label: "VPS name", required: true },
  { name: "vps_number", label: "VPS number" },
  { name: "ip", label: "Login IP" },
  { name: "provider", label: "Provider" },
  { name: "username", label: "Username" },
  { name: "password", label: "Password" },
  { name: "email", label: "Email used", full: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

function VpsPage() {
  const { data: rows = [] } = useTable<Vps>("vps");
  const { data: accounts = [] } = useTable<Account>("accounts");
  const save = useSaveRow("vps");
  const del = useDeleteRow("vps");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const attached = (vpsId: string) => accounts.filter((a) => a.vps_id === vpsId);

  return (
    <div>
      <PageHeader
        title="VPS Servers"
        subtitle="Every server, its login details and the broker accounts running on it."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add VPS
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>No.</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Accounts attached</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No VPS yet. Add your first server.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.vps_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{v.ip ?? "—"}</TableCell>
                  <TableCell>{v.username ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{v.password ?? "—"}</TableCell>
                  <TableCell className="text-xs">{v.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {attached(v.id).length === 0
                      ? "—"
                      : attached(v.id)
                          .map((a) => `${a.broker} ${a.account_name}`)
                          .join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(v);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(v.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit VPS" : "Add VPS"}
        fields={fields}
        initial={editing}
        onSubmit={(vals) => {
          save.mutate(vals);
          setOpen(false);
        }}
      />
    </div>
  );
}
