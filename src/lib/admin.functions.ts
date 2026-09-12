import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const normalize = (u: string) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; password: string }) => {
    const username = normalize(input.username ?? "");
    if (username.length < 3) throw new Error("Username must be at least 3 characters");
    if ((input.password ?? "").length < 6) throw new Error("Password must be at least 6 characters");
    return { username, password: input.password };
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
      user_metadata: { username: data.username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the admin user");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleErr) throw new Error(roleErr.message);

    return { username: data.username };
  });
