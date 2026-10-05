import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PermAction = "view" | "add" | "edit" | "delete";

export interface PagePerm {
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const EMPTY_PERM: PagePerm = {
  can_view: false,
  can_add: false,
  can_edit: false,
  can_delete: false,
};

/** Every page an admin account can be given access to. */
export const PERMISSION_PAGES = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "vps", label: "VPS", path: "/vps" },
  { key: "accounts", label: "Accounts", path: "/accounts" },
  { key: "daily-log", label: "Daily Log", path: "/daily-log" },
  { key: "costs", label: "Costs", path: "/costs" },
  { key: "transfers", label: "Transfers", path: "/transfers" },
  { key: "bots", label: "Bot Manager", path: "/bots" },
  { key: "movements", label: "Movements", path: "/movements" },
  { key: "problems", label: "Problems", path: "/problems" },
  { key: "report", label: "Report", path: "/report" },
  { key: "summary", label: "Summary", path: "/summary" },
  { key: "records", label: "Records", path: "/records" },
  { key: "notes", label: "Notes & To-do", path: "/notes" },
] as const;

export type PermissionMap = Record<string, PagePerm>;

/** Which page a table belongs to, so writes can be checked centrally. */
const TABLE_PAGE: Record<string, string> = {
  vps: "vps",
  accounts: "accounts",
  daily_logs: "daily-log",
  costs: "costs",
  cost_purposes: "costs",
  transactions: "transfers",
  people: "transfers",
  payment_sources: "dashboard",
  bots: "bots",
  movements: "movements",
  funding_events: "daily-log",
  problems: "problems",
  day_results: "daily-log",
  saved_reports: "report",
  trading_days: "dashboard",
};

export function pathPageKey(pathname: string) {
  if (pathname === "/") return "dashboard";
  const match = PERMISSION_PAGES.find(
    (p) => p.path !== "/" && pathname.startsWith(p.path),
  );
  return match?.key ?? null;
}

async function fetchAccess() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { isAdmin: false, perms: {} as PermissionMap };

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = Boolean(roleRow);
  if (!isAdmin) return { isAdmin: false, perms: {} as PermissionMap };

  const { data: rows } = await supabase
    .from("admin_permissions")
    .select("page, can_view, can_add, can_edit, can_delete")
    .eq("user_id", user.id);

  const perms: PermissionMap = {};
  (rows ?? []).forEach((r) => {
    perms[r.page as string] = {
      can_view: Boolean(r.can_view),
      can_add: Boolean(r.can_add),
      can_edit: Boolean(r.can_edit),
      can_delete: Boolean(r.can_delete),
    };
  });
  return { isAdmin, perms };
}

/** Where a limited user should land: their first permitted page. */
export async function firstAllowedPath() {
  const access = await fetchAccess();
  if (!access.isAdmin) return "/";
  const page = PERMISSION_PAGES.find((p) => access.perms[p.key]?.can_view);
  return page?.path ?? "/notes";
}

export function useAccess() {
  return useQuery({
    queryKey: ["my-access"],
    queryFn: fetchAccess,
    staleTime: 60 * 1000,
  });
}

export function allows(
  access: { isAdmin: boolean; perms: PermissionMap } | undefined,
  pageKey: string | null,
  action: PermAction,
) {
  if (!access) return false;
  if (!access.isAdmin) return true; // the owner keeps full control
  if (!pageKey) return false;
  const perm = access.perms[pageKey] ?? EMPTY_PERM;
  if (action === "view") return perm.can_view;
  if (action === "add") return perm.can_view && perm.can_add;
  if (action === "edit") return perm.can_view && perm.can_edit;
  return perm.can_view && perm.can_delete;
}

/** Throws when the signed-in admin may not write to this table. */
export async function assertTableAccess(table: string, action: PermAction) {
  const access = await fetchAccess();
  if (!access.isAdmin) return;
  const pageKey = TABLE_PAGE[table] ?? null;
  if (!allows(access, pageKey, action)) {
    throw new Error("You do not have permission for this action.");
  }
}
