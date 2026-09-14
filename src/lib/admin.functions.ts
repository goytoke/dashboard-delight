import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const normalize = (u: string) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");

type Input = {
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  avatarUrl?: string;
};

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    const username = normalize(input.username ?? "");
    if (username.length < 3) throw new Error("Username must be at least 3 characters");
    if ((input.password ?? "").length < 6) throw new Error("Password must be at least 6 characters");
    const role = input.role === "owner" ? "owner" : "admin";
    return {
      username,
      password: input.password,
      firstName: (input.firstName ?? "").trim(),
      lastName: (input.lastName ?? "").trim(),
      phone: (input.phone ?? "").trim(),
      role: role as "admin" | "owner",
      avatarUrl: (input.avatarUrl ?? "").trim(),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) > 0) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Only an admin can create another admin");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.username}@bottracker.local`,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        phone: data.phone || null,
        avatar_url: data.avatarUrl || null,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the admin user");

    await supabaseAdmin
      .from("profiles")
      .update({
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        phone: data.phone || null,
        avatar_url: data.avatarUrl || null,
      })
      .eq("id", created.user.id);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { username: data.username, role: data.role };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0 && !isAdmin) return [];

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (!roles?.length) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username, first_name, last_name, phone")
      .in(
        "id",
        roles.map((r) => r.user_id),
      );

    return roles.map((r) => {
      const p = profiles?.find((x) => x.id === r.user_id);
      return {
        id: r.user_id,
        role: r.role as string,
        username: p?.username ?? "—",
        firstName: p?.first_name ?? "",
        lastName: p?.last_name ?? "",
        phone: p?.phone ?? "",
      };
    });
  });
