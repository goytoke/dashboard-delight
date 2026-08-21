import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { RecordDialog, type FieldSpec } from "@/components/RecordDialog";
import { accountDeadline } from "@/lib/alerts";
import { useDeadlineConfig } from "@/lib/settings";
import {
  money,
  today,
  useDeleteRow,
  useSaveRow,
  useTable,
  type Account,
  type Row,
  type Vps,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

const STATUSES = ["active", "reserve", "churned"] as const;

const statusTone: Record<string, string> = {
  active: "bg-primary/15 text-primary border-primary/30",
  reserve: "bg-secondary text-secondary-foreground border-border",
  churned: "bg-destructive/15 text-destructive border-destructive/30",
};

function AccountsPage() {
  const { data: accounts = [] } = useTable<Account>("accounts");
  const { data: servers = [] } = useTable<Vps>("vps");
  const save = useSaveRow("accounts");
  const del = useDeleteRow("accounts");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [tab, setTab] = useState<string>("all");
  const { config, update } = useDeadlineConfig();
  const [cycleDraft, setCycleDraft] = useState("");
  const [alertDraft, setAlertDraft] = useState("");

  const fields: FieldSpec[] = [
    {
      name: "broker",
      label: "Broker",
      type: "select",
      required: true,
      options: [
        { value: "HFM", label: "HFM" },
        { value: "Tickmill", label: "Tickmill" },
      ],
    },
    { name: "account_name", label: "Account name", required: true },
    { name: "email", label: "Email" },
    { name: "password", label: "Password" },
    { name: "login", label: "Login" },
    { name: "login_password", label: "Login password" },
    { name: "first_deposit", label: "First deposit", type: "number" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: [
        { value: "active", label: "Active" },
        { value: "reserve", label: "Reserve" },
        { value: "churned", label: "Churned" },
      ],
    },
    {
      name: "vps_id",
      label: "VPS",
      type: "select",
      options: servers.map((v) => ({ value: v.id, label: v.name })),
    },
    { name: "activated_on", label: "Active since", type: "date" },
    { name: "cycle_days", label: "Deadline (days from activation)", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const visible = tab === "all" ? accounts : accounts.filter((a) => a.status === tab);

  const transfer = (a: Account, status: string) => {
    save.mutate({
      id: a.id,
      status,
      activated_on:
        status === "active" ? today() : status === "reserve" ? null : a.activated_on,
      ...(status === "active" ? { cycle_days: a.cycle_days ?? config.accountCycleDays } : {}),
    });
  };


  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="HFM and Tickmill accounts. Move them between active, reserve and churned."
        actions={
          <Button
            onClick={() => {
              setEditing({
                status: "reserve",
                broker: "HFM",
                cycle_days: config.accountCycleDays,
              });
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add account
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <Label htmlFor="cycle-days" className="text-xs text-muted-foreground">
              Account deadline (days)
            </Label>
            <Input
              id="cycle-days"
              type="number"
              min={1}
              className="w-32"
              value={cycleDraft === "" ? String(config.accountCycleDays) : cycleDraft}
              onChange={(e) => setCycleDraft(e.target.value)}
              onBlur={() => {
                const n = Number(cycleDraft);
                if (cycleDraft !== "" && n > 0) update({ accountCycleDays: n });
                setCycleDraft("");
              }}
            />
          </div>
          <div>
            <Label htmlFor="alert-days" className="text-xs text-muted-foreground">
              Alert before (days)
            </Label>
            <Input
              id="alert-days"
              type="number"
              min={0}
              className="w-32"
              value={alertDraft === "" ? String(config.alertBeforeDays) : alertDraft}
              onChange={(e) => setAlertDraft(e.target.value)}
              onBlur={() => {
                const n = Number(alertDraft);
                if (alertDraft !== "" && n >= 0) update({ alertBeforeDays: n });
                setAlertDraft("");
              }}
            />
          </div>
          <Button
            variant="outline"
            onClick={() =>
              accounts
                .filter((a) => a.status === "active")
                .forEach((a) => save.mutate({ id: a.id, cycle_days: config.accountCycleDays }))
            }
          >
            Apply to all active accounts
          </Button>
          <p className="text-xs text-muted-foreground">
            An active account runs {config.accountCycleDays} days from its activation date. You get a
            pop-up {config.alertBeforeDays} day(s) before the deadline; after the deadline the row is
            blurred and locked.
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All ({accounts.length})</TabsTrigger>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s} ({accounts.filter((a) => a.status === s).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broker</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>First deposit</TableHead>
                <TableHead>VPS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No accounts here yet.
                  </TableCell>
                </TableRow>
              )}
              {visible.map((a) => {
                const dl = accountDeadline(a, config.accountCycleDays);
                const expired = dl?.expired ?? false;
                return (
                <TableRow key={a.id} className={expired ? "opacity-40 blur-[1px]" : undefined}>
                  <TableCell className="font-medium">{a.broker}</TableCell>
                  <TableCell>{a.account_name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.login ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a.email ?? "—"}</TableCell>
                  <TableCell>{money(a.first_deposit)}</TableCell>
                  <TableCell className="text-xs">
                    {servers.find((v) => v.id === a.vps_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusTone[a.status]}`}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {dl ? (
                      <span className={dl.expired ? "text-destructive" : undefined}>
                        {dl.endDate} —{" "}
                        {dl.expired
                          ? `expired ${Math.abs(dl.daysLeft)}d ago`
                          : `${dl.daysLeft}d left`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" title="Transfer" disabled={expired}>
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {STATUSES.filter((s) => s !== a.status).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            className="capitalize"
                            onClick={() => transfer(a, s)}
                          >
                            Move to {s}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={expired}
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={expired}
                      onClick={() => del.mutate(a.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>



      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.["id"] ? "Edit account" : "Add account"}
        description="Choose Active or Reserve when creating. Active accounts appear in the Daily Log."
        fields={fields}
        initial={editing}
        onSubmit={(vals) => {
          const v = { ...vals };
          if (v["status"] === "active" && !v["activated_on"]) v["activated_on"] = today();
          save.mutate(v);
          setOpen(false);
        }}
      />
    </div>
  );
}
