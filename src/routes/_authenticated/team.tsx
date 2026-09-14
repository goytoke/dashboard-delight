import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { createAdminUser, listAdminUsers } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Admin accounts — Bot Ops Tracker" },
      {
        name: "description",
        content:
          "Create admin logins with name, phone, username, password, role and photo, and see who already has access.",
      },
      { property: "og:title", content: "Admin accounts — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Create and review the people who can sign in to the admin overview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listAdminUsers(),
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

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
      toast.success(`${res.username} can now log in as ${res.role}.`);
      setFirstName("");
      setLastName("");
      setPhone("");
      setUsername("");
      setPassword("");
      setPhoto(null);
      setRole("admin");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the account");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin accounts"
        subtitle="Create a login here and hand the username and password over. That person lands straight on the admin overview."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldPlus className="h-4 w-4" /> New account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
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
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating..." : "Create account"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People with access ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">No accounts created yet.</p>
          )}
          {members.map((m) => (
            <div
              key={`${m.id}-${m.role}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.username}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.username}
                  {m.phone ? ` · ${m.phone}` : ""}
                </p>
              </div>
              <Badge variant="secondary">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
