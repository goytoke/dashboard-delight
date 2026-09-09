import { useState } from "react";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { money, type DayResult, type Row, type Vps } from "@/lib/db";

export const resultsNetOf = (list: DayResult[]) =>
  list.reduce((s, r) => s + (r.direction === "loss" ? -Number(r.amount) : Number(r.amount)), 0);

const signedOf = (r: DayResult) =>
  r.direction === "loss" ? -Number(r.amount) : Number(r.amount);

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Monday of the week containing `d`. */
const weekStart = (d: string) => {
  const x = new Date(`${d}T00:00:00`);
  const dow = (x.getDay() + 6) % 7;
  return addDays(d, -dow);
};

/** Which week of the month the date falls in (1-based). */
const weekOfMonth = (d: string) => {
  const day = Number(d.slice(8, 10));
  const firstDow = (new Date(`${d.slice(0, 8)}01T00:00:00`).getDay() + 6) % 7;
  return Math.floor((day + firstDow - 1) / 7) + 1;
};

const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const monthEnd = (d: string) => {
  const x = new Date(`${d.slice(0, 7)}-01T00:00:00`);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return x.toISOString().slice(0, 10);
};

/**
 * Net profit / loss of the day per VPS. Pick the VPS, choose + for a profit
 * or − for a loss, type the combined net amount and save.
 */
export function DayResults({
  date,
  vpsList,
  results,
  onSave,
  onDelete,
}: {
  date: string;
  vpsList: Vps[];
  results: DayResult[];
  onSave: (row: Row) => void;
  onDelete: (id: string) => void;
}) {
  const [vpsId, setVpsId] = useState<string>("");
  const [direction, setDirection] = useState<"profit" | "loss">("profit");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const dayRows = results.filter((r) => r.result_date === date);
  const net = resultsNetOf(dayRows);
  const vpsName = (id: string | null) => vpsList.find((v) => v.id === id)?.name ?? "—";

  const wFrom = weekStart(date);
  const wTo = addDays(wFrom, 6);
  const mFrom = monthStart(date);
  const mTo = monthEnd(date);
  const inRange = (from: string, to: string) =>
    results.filter((r) => r.result_date >= from && r.result_date <= to);
  const weekRows = inRange(wFrom, wTo);
  const monthRows = inRange(mFrom, mTo);

  const perVps = (list: DayResult[]) => {
    const map = new Map<string, number>();
    list.forEach((r) => {
      const key = vpsName(r.vps_id);
      map.set(key, (map.get(key) ?? 0) + signedOf(r));
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const save = () => {
    const value = Number(amount);
    if (!vpsId) {
      toast.error("Choose the VPS this net profit or loss belongs to.");
      return;
    }
    if (!amount || Number.isNaN(value) || value <= 0) {
      toast.error("Type the net amount of the profit or the loss.");
      return;
    }
    onSave({
      result_date: date,
      vps_id: vpsId,
      register_number: null,
      direction,
      amount: value,
      label: label.trim() || null,
    });
    setAmount("");
    setLabel("");
  };

  return (
    <Card className="mt-6">
      <CardHeader className="gap-3">
        <CardTitle className="text-base">Profit / loss of {date}</CardTitle>
        <p className="text-sm text-muted-foreground">
          One line per VPS — the combined net of both brokers on that server. It becomes the income
          line of the report.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">VPS</Label>
            <Select value={vpsId} onValueChange={setVpsId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose VPS" />
              </SelectTrigger>
              <SelectContent>
                {vpsList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Profit or loss</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={direction === "profit" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDirection("profit")}
              >
                <Plus className="mr-1 h-4 w-4" /> Profit
              </Button>
              <Button
                type="button"
                variant={direction === "loss" ? "destructive" : "outline"}
                className="flex-1"
                onClick={() => setDirection("loss")}
              >
                <Minus className="mr-1 h-4 w-4" /> Loss
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Net amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Short note"
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={save}>
              <Save className="mr-1 h-4 w-4" /> Add & save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>VPS</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">Net P/L</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dayRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No profit or loss recorded on {date}.
                </TableCell>
              </TableRow>
            )}
            {dayRows.map((r) => {
              const signed = signedOf(r);
              return (
                <TableRow key={r.id}>
                  <TableCell>{vpsName(r.vps_id)}</TableCell>
                  <TableCell>{r.label ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={signed >= 0 ? "text-primary" : "text-destructive"}>
                      {signed >= 0 ? "+" : ""}
                      {signed.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Net result of the day
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {net >= 0 ? "+" : ""}
                {net.toFixed(2)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
        <p className="px-6 py-3 text-xs text-muted-foreground">
          Total money value of the entries above: {money(Math.abs(net))}.
        </p>

        <div className="space-y-2 border-t border-border px-6 py-4">
          <Summary
            title={`Weekly net P/L — week ${weekOfMonth(date)} (${wFrom} → ${wTo})`}
            rows={perVps(weekRows)}
            total={resultsNetOf(weekRows)}
          />
          <Summary
            title={`Monthly net P/L (${mFrom} → ${mTo})`}
            rows={perVps(monthRows)}
            total={resultsNetOf(monthRows)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Summary({
  title,
  rows,
  total,
}: {
  title: string;
  rows: [string, number][];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span>{title}</span>
          <span className={total >= 0 ? "font-mono text-primary" : "font-mono text-destructive"}>
            {total >= 0 ? "+" : ""}
            {total.toFixed(2)}
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>VPS</TableHead>
              <TableHead className="text-right">Net P/L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                  Nothing recorded in this period.
                </TableCell>
              </TableRow>
            )}
            {rows.map(([name, value]) => (
              <TableRow key={name}>
                <TableCell>{name}</TableCell>
                <TableCell className="text-right font-mono">
                  <span className={value >= 0 ? "text-primary" : "text-destructive"}>
                    {value >= 0 ? "+" : ""}
                    {value.toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}
