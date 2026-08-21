import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login — Bot Ops Tracker" },
      {
        name: "description",
        content: "Log in with your username and password to manage VPS servers, accounts and bots.",
      },
      { property: "og:title", content: "Login — Bot Ops Tracker" },
      {
        property: "og:description",
        content: "Private console for VPS, broker accounts, daily balances and bot registry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const normalize = (u: string) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
const syntheticEmail = (u: string) => `${normalize(u)}@bottracker.local`;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const signIn = async () => {
    const u = normalize(username);
    if (!u || !password) {
      toast.error("Username and password are required");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: syntheticEmail(u),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("not confirmed")
          ? "Account not activated yet — try again in a moment"
          : "Invalid username or password",
      );
      return;
    }
    navigate({ to: "/" });
  };

  const signUp = async () => {
    const u = normalize(username);
    if (u.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: syntheticEmail(u),
      password,
      options: { data: { username: u, phone: phone.trim() } },
    });
    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      toast.error(
        m.includes("already")
          ? "Username already taken"
          : m.includes("weak") || m.includes("pwned")
            ? "Password is too common — pick a stronger one"
            : error.message,
      );
      return;
    }
    const userId = data.user?.id;
    if (photo && userId) {
      const ext = photo.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, photo, {
        upsert: true,
      });
      if (!upErr) {
        await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      }
    }
    setLoading(false);
    if (data.session) {
      navigate({ to: "/" });
      return;
    }
    toast.success("Account created. You can log in now.");
    setMode("login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Login" : "Create an account"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Enter your username and password."
              : "Set up your account details."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && mode === "login") signIn();
              }}
            />
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="photo">Photo (optional)</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </>
          )}

          <Button
            className="w-full"
            disabled={loading}
            onClick={mode === "login" ? signIn : signUp}
          >
            {mode === "login" ? "Login" : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-4"
                  onClick={() => setMode("signup")}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-4"
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
