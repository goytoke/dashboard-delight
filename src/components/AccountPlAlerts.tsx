import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTable, type Account } from "@/lib/db";

export const PL_WARN = 450;
export const PL_CHURN = 600;

export function plLevel(a: Pick<Account, "total_net_pl" | "status">) {
  if (a.status === "churned") return null;
  const v = Number(a.total_net_pl ?? 0);
  if (v > PL_CHURN) return "churn" as const;
  if (v >= PL_WARN) return "warn" as const;
  return null;
}

/** Pops a reminder for every account whose total net P/L reached the limits. */
export function AccountPlAlerts() {
  const { data: accounts = [] } = useTable<Account>("accounts");
  const shown = useRef(new Set<string>());

  useEffect(() => {
    accounts.forEach((a) => {
      const level = plLevel(a);
      if (!level) return;
      const key = `${a.id}-${level}-${a.total_net_pl}`;
      if (shown.current.has(key)) return;
      shown.current.add(key);
      const name = `${a.broker} ${a.account_name}`;
      if (level === "churn") {
        toast.error(`${name}: net P/L ${a.total_net_pl} is above ${PL_CHURN}. Move it to churned.`, {
          duration: 15000,
        });
      } else {
        toast.warning(`${name}: net P/L ${a.total_net_pl} reached ${PL_WARN}. Remember this account.`, {
          duration: 10000,
        });
      }
    });
  }, [accounts]);

  return null;
}
