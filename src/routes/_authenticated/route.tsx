import { useEffect } from "react";
import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAccess, allows, pathPageKey, PERMISSION_PAGES } from "@/lib/permissions";
import { AccountPlAlerts } from "@/components/AccountPlAlerts";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RefreshButton } from "@/components/RefreshButton";
import { DayControl } from "@/components/DayControl";

import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { data: access } = useAccess();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  useEffect(() => {
    if (!access?.isAdmin) return;
    if (allows(access, pathPageKey(path), "view")) return;
    const first = PERMISSION_PAGES.find((p) => access.perms[p.key]?.can_view);
    const target = first?.path ?? "/notes";
    if (target !== path) navigate({ to: target as "/" });
  }, [access, path, navigate]);
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-12 items-center gap-2 border-b border-border px-3">
            <SidebarTrigger />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Bot &amp; Account Tracker
            </span>
            <div className="ml-auto flex items-center gap-2">
              <DayControl />
              <ThemeToggle />
              <RefreshButton />
            </div>

          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
            <AccountPlAlerts />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
