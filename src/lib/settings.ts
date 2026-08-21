import { useCallback, useEffect, useState } from "react";

export type DeadlineConfig = {
  accountCycleDays: number;
  vpsTermDays: number;
  alertBeforeDays: number;
};

export const DEFAULT_DEADLINES: DeadlineConfig = {
  accountCycleDays: 14,
  vpsTermDays: 3,
  alertBeforeDays: 2,
};

const KEY = "deadline-config";

export function readDeadlineConfig(): DeadlineConfig {
  if (typeof window === "undefined") return DEFAULT_DEADLINES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DEADLINES;
    return { ...DEFAULT_DEADLINES, ...(JSON.parse(raw) as Partial<DeadlineConfig>) };
  } catch {
    return DEFAULT_DEADLINES;
  }
}

/** Deadline lengths are a local preference — changing them re-dates every account/VPS view. */
export function useDeadlineConfig() {
  const [config, setConfig] = useState<DeadlineConfig>(DEFAULT_DEADLINES);

  useEffect(() => {
    setConfig(readDeadlineConfig());
    const onChange = () => setConfig(readDeadlineConfig());
    window.addEventListener("deadline-config", onChange);
    return () => window.removeEventListener("deadline-config", onChange);
  }, []);

  const update = useCallback((next: Partial<DeadlineConfig>) => {
    const merged = { ...readDeadlineConfig(), ...next };
    window.localStorage.setItem(KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("deadline-config"));
    setConfig(merged);
  }, []);

  return { config, update };
}
