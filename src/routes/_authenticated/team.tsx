import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldPlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  setAdminPermissions,
  updateAdminUser,
} from "@/lib/admin.functions";
import { PERMISSION_PAGES, EMPTY_PERM, type PagePerm } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Admin accounts — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Create logins with name, phone, username, password and role, switch page access on or off, and edit or remove accounts.",
      },
      { property: "og:title", content: "Admin accounts — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Create, edit and remove the people who can sign in, and choose what each one may do.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

type PermMap = Record<string, PagePerm>;

const blankPerms = (): PermMap =>
  Object.fromEntries(PERMISSION_PAGES.map((p) => [p.key, { ...EMPTY_PERM }]));

function PermissionGrid({
  value,
  onChange,
}: {
  value: PermMap;
  onChange: (next: PermMap) => void;
}) {
  const set = (key: string, field: keyof PagePerm, on: boolean) =>
    onChange({
      ...value,
      [key]: { ...(value[key] ?? EMPTY_PERM), [field]: on },
    });

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead className="text-center">See</TableHead>
            <TableHead className="text-center">Add</TableHead>
            <TableHead className="text-center">Edit</TableHead>
            <TableHead className="text-center">Delete</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PERMISSION_PAGES.map((page) => {
            const perm = value[page.key] ?? EMPTY_PERM;
            return (
              <TableRow key={page.key}>
                <TableCell className="whitespace-nowrap">{page.label}</TableCell>
                {(["can_view", "can_add", "can_edit", "can_delete"] as const).map((f) => (
                  <TableCell key={f} className="text-center">
                    <Switch
                      checked={perm[f]}
                      onCheckedChange={(on) => set(page.key, f, on)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TeamPage() {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listAdminUsers(),
  });

  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [photo, setPhoto] = useState<File | null>(null);
  const [perms, setPerms] = useState<PermMap>(blankPerms);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<(typeof members)[number] | null>(null);
  const [removing, setRemoving] = useState<(typeof members)[number] | null>(null);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setUsername("");
    setPassword("");
    setPhoto(null);
    setRole("admin");
    setPerms(blankPerms());
  };

  const create = async () => {
    if (username.trim().length < 3 || password.length < 6) {
      toast.error("Enter a username (3+ letters) and a password of at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      let avatarUrl = "";
      if (photo) {
        const ext = photo.name.split(".").pop() ?? "jpg";
        const path = `admins/${Date.now()}-${username.trim().toLowerCase()}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, photo, {
          upsert: true,
        });
        if (error) throw new Error(error.message);
        avatarUrl = path;
      }
      const res = await createAdminUser({
        data: { username, password, firstName, lastName, phone, role, avatarUrl },
      });
      await setAdminPermissions({
        data: {
          id: res.id,
          permissions: PERMISSION_PAGES.map((p) => ({
            page: p.key,
            ...(perms[p.key] ?? EMPTY_PERM),
          })),
        },
      });
      toast.success(`${res.username} can now log in as ${res.role}.`);
      reset();
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the account");
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await deleteAdminUser({ data: { id: removing.id } });
      toast.success(`${removing.username} was removed.`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the account");
    }
    setRemoving(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin accounts"
        subtitle="Create a login, hand over the username and password, and switch on exactly the pages and actions that person may use."
      />

      <div className="flex justify-end">
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "outline" : "default"}>
          {showForm ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {showForm ? "Close form" : "Add account"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldPlus className="h-4 w-4" /> New account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone number</Label>
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (limited access)</SelectItem>
                    <SelectItem value="owner">Owner (full access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Photo (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {role === "admin" && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">What this person may do</Label>
                <PermissionGrid value={perms} onChange={setPerms} />
              </div>
            )}

            <Button onClick={create} disabled={saving}>
              {saving ? "Creating..." : "Create account"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People with access ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={`${m.id}-${m.role}`}>
                  <TableCell>
                    {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.username}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.username}</TableCell>
                  <TableCell className="text-muted-foreground">{m.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setRemoving(m)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No accounts created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditDialog
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["admin-users"] });
        }}
      />

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.username} will no longer be able to sign in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Member = Awaited<ReturnType<typeof listAdminUsers>>[number];

function EditDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("admin");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<PermMap>(blankPerms);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return;
    setFirstName(member.firstName ?? "");
    setLastName(member.lastName ?? "");
    setPhone(member.phone ?? "");
    setRole(member.role);
    setPassword("");
    const next = blankPerms();
    member.permissions.forEach((p) => {
      next[p.page] = {
        can_view: p.can_view,
        can_add: p.can_add,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      };
    });
    setPerms(next);
  }, [member]);

  const save = async () => {
    if (!member) return;
    if (password && password.length < 6) {
      toast.error("A new password needs at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await updateAdminUser({
        data: { id: member.id, firstName, lastName, phone, role, password: password || undefined },
      });
      await setAdminPermissions({
        data: {
          id: member.id,
          permissions: PERMISSION_PAGES.map((p) => ({
            page: p.key,
            ...(perms[p.key] ?? EMPTY_PERM),
          })),
        },
      });
      toast.success(`${member.username} was updated.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the account");
    }
    setSaving(false);
  };

  return (
    <Dialog open={Boolean(member)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {member?.username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone number</Label>
              <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (limited access)</SelectItem>
                  <SelectItem value="owner">Owner (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">
                New password (leave empty to keep the current one)
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {role === "admin" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">What this person may do</Label>
              <PermissionGrid value={perms} onChange={setPerms} />
            </div>
          )}

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
