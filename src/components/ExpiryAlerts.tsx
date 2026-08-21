import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Server, Wallet } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  accountExpiry,
  expiryText,
  subscriptionAlerts,
  vpsExpiry,
  type ExpiryAlert,
} from "@/lib/alerts";
import { today, type Account, type Cost, type Vps } from "@/lib/db";
import { useDeadlineConfig } from "@/lib/settings";

const KEY = "expiry-alert-shown";

export function useExpiryAlerts(
  servers: Vps[],
  accounts: Account[],
  costs: Cost[] = [],
): ExpiryAlert[] {
  const { config } = useDeadlineConfig();
  return [
    ...vpsExpiry(servers, config.alertBeforeDays, config.vpsTermDays),
    ...accountExpiry(accounts, config.alertBeforeDays, config.accountCycleDays),
    ...subscriptionAlerts(costs),
  ];
}


export function ExpiryAlertDialog({ alerts }: { alerts: ExpiryAlert[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alerts.length === 0) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY) === today()) return;
    setOpen(true);
  }, [alerts.length]);

  const dismiss = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, today());
    setOpen(false);
  };

  if (alerts.length === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Renewal reminder
          </AlertDialogTitle>
          <AlertDialogDescription>
            These items are about to reach the end of their paid term or cycle.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
            >
              {a.kind === "vps" ? (
                <Server className="h-4 w-4 shrink-0" />
              ) : a.kind === "subscription" ? (
                <CalendarClock className="h-4 w-4 shrink-0" />
              ) : (
                <Wallet className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium">{a.label}</span>
              <span className="text-muted-foreground">
                — {expiryText(a)} (ends {a.endDate})
              </span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogAction onClick={dismiss}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
