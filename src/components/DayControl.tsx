import { DoorClosed, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  computeDay,
  useCloseDay,
  useOpenDay,
  useTradingDays,
  type TradingDay,
} from "@/lib/day";
import {
  today,
  useTable,
  type Account,
  type Cost,
  type DailyLog,
  type FundingEvent,
  type Movement,
  type Transaction,
} from "@/lib/db";

export function useDayFor(date: string): TradingDay | undefined {
  const { data: days = [] } = useTradingDays();
  return days.find((d) => d.day_date === date);
}

export function DayControl({ date = today() }: { date?: string }) {
  const day = useDayFor(date);
  const open = useOpenDay();
  const close = useCloseDay();

  const { data: accounts = [] } = useTable<Account>("accounts");
  const { data: logs = [] } = useTable<DailyLog>("daily_logs", "log_date", false);
  const { data: funding = [] } = useTable<FundingEvent>("funding_events", "event_date", false);
  const { data: costs = [] } = useTable<Cost>("costs", "cost_date", false);
  const { data: transactions = [] } = useTable<Transaction>("transactions", "tx_date", false);
  const { data: movements = [] } = useTable<Movement>("movements", "move_date", false);

  const isOpen = day?.status === "open";
  const isClosed = day?.status === "closed";

  return (
    <div className="flex items-center gap-2">
      <Badge variant={isOpen ? "default" : isClosed ? "secondary" : "outline"}>
        {isOpen ? "Day open" : isClosed ? "Day closed" : "Not opened"}
      </Badge>
      {isOpen ? (
        <Button
          size="sm"
          variant="outline"
          disabled={close.isPending}
          onClick={() =>
            close.mutate({
              date,
              snapshot: computeDay(date, {
                accounts,
                logs,
                funding,
                costs,
                transactions,
                movements,
              }),
            })
          }
        >
          <DoorClosed className="mr-1 h-4 w-4" /> Close
        </Button>
      ) : (
        <Button size="sm" disabled={open.isPending} onClick={() => open.mutate(date)}>
          <DoorOpen className="mr-1 h-4 w-4" /> {isClosed ? "Reopen" : "Open"}
        </Button>
      )}
    </div>
  );
}
