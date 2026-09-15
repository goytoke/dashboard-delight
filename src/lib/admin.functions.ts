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

type PermRow = {
  page: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/** The caller may manage an account when they are an admin or they created it. */
async function assertCanManage(isAdmin: boolean, userId: string, targetId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (isAdmin) return;
  if (targetId) {
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("created_by")
      .eq("user_id", targetId)
      .maybeSingle();
    if (row && (row.created_by === userId || row.created_by === null)) return;
    throw new Error("You cannot manage this account.");
  }
}

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
      .insert({ user_id: created.user.id, role: data.role, created_by: context.userId });
    if (roleErr) throw new Error(roleErr.message);

    return { id: created.user.id, username: data.username, role: data.role };
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: string;
      password?: string;
    }) => {
      if (!input.id) throw new Error("Missing account");
      if (input.password && input.password.length < 6)
        throw new Error("Password must be at least 6 characters");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context, context.userId, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    }

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: (data.firstName ?? "").trim() || null,
        last_name: (data.lastName ?? "").trim() || null,
        phone: (data.phone ?? "").trim() || null,
      })
      .eq("id", data.id);
    if (pErr) throw new Error(pErr.message);

    if (data.role === "admin" || data.role === "owner") {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .update({ role: data.role })
        .eq("user_id", data.id);
      if (rErr) throw new Error(rErr.message);
    }

    return { ok: true };
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("Missing account");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (data.id === context.userId) throw new Error("You cannot delete your own account.");
    await assertCanManage(context, context.userId, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_permissions").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAdminPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; permissions: PermRow[] }) => {
    if (!input.id) throw new Error("Missing account");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertCanManage(context, context.userId, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.permissions.map((p) => ({
      user_id: data.id,
      page: p.page,
      can_view: Boolean(p.can_view),
      can_add: Boolean(p.can_add),
      can_edit: Boolean(p.can_edit),
      can_delete: Boolean(p.can_delete),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("admin_permissions")
      .upsert(rows, { onConflict: "user_id,page" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_by");
    if (!roles?.length) return [];

    const visible = isAdmin
      ? roles
      : roles.filter((r) => r.created_by === context.userId || r.created_by === null);
    if (!visible.length) return [];

    const ids = visible.map((r) => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username, first_name, last_name, phone")
      .in("id", ids);
    const { data: perms } = await supabaseAdmin
      .from("admin_permissions")
      .select("user_id, page, can_view, can_add, can_edit, can_delete")
      .in("user_id", ids);

    return visible.map((r) => {
      const p = profiles?.find((x) => x.id === r.user_id);
      return {
        id: r.user_id,
        role: r.role as string,
        username: p?.username ?? "—",
        firstName: p?.first_name ?? "",
        lastName: p?.last_name ?? "",
        phone: p?.phone ?? "",
        permissions: (perms ?? [])
          .filter((x) => x.user_id === r.user_id)
          .map((x) => ({
            page: x.page as string,
            can_view: Boolean(x.can_view),
            can_add: Boolean(x.can_add),
            can_edit: Boolean(x.can_edit),
            can_delete: Boolean(x.can_delete),
          })),
      };
    });
  });
