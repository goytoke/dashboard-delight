import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Server,
  Wallet,
  NotebookPen,
  Receipt,
  ArrowLeftRight,
  Bot,
  BarChart3,
  AlertTriangle,
  Shuffle,
  FolderClock,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "VPS", url: "/vps", icon: Server },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "Daily Log", url: "/daily-log", icon: NotebookPen },
  { title: "Costs", url: "/costs", icon: Receipt },
  { title: "Transfers", url: "/transfers", icon: ArrowLeftRight },
  { title: "Bot Manager", url: "/bots", icon: Bot },
  { title: "Movements", url: "/movements", icon: Shuffle },
  { title: "Problems", url: "/problems", icon: AlertTriangle },
  { title: "Report", url: "/report", icon: BarChart3 },
  { title: "Records", url: "/records", icon: FolderClock },
] as const;

export function AppSidebar() {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div className="truncate">
            <p className="truncate text-sm font-semibold">Bot Ops</p>
            <p className="truncate text-xs text-muted-foreground">Tracking console</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={item.url === "/" ? currentPath === "/" : currentPath.startsWith(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
