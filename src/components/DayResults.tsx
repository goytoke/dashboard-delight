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
import { money, type DayResult, type Row, type Vps } from "@/lib/db";

export const resultsNetOf = (list: DayResult[]) =>
  list.reduce((s, r) => s + (r.direction === "loss" ? -Number(r.amount) : Number(r.amount)), 0);

/**
 * Profit or loss of the day per VPS / register number. Pick + for a profit or
 * − for a loss, type the amount and the label, then save.
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
  const [vpsId, setVpsId] = useState<string>("none");
  const [register, setRegister] = useState("");
  const [direction, setDirection] = useState<"profit" | "loss">("profit");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const dayRows = results.filter((r) => r.result_date === date);
  const net = resultsNetOf(dayRows);
  const vpsName = (id: string | null) => vpsList.find((v) => v.id === id)?.name ?? "—";

  const save = () => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      toast.error("Type the amount of the profit or the loss.");
      return;
    }
    onSave({
      result_date: date,
      vps_id: vpsId === "none" ? null : vpsId,
      register_number: register.trim() || null,
      direction,
      amount: value,
      label: label.trim() || null,
    });
    setRegister("");
    setAmount("");
    setLabel("");
  };

  return (
    <Card className="mt-6">
      <CardHeader className="gap-3">
        <CardTitle className="text-base">Profit / loss of {date}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Record the result per VPS or register number. It becomes the income line of the report.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">VPS</Label>
            <Select value={vpsId} onValueChange={setVpsId}>
              <SelectTrigger>
                <SelectValue placeholder="VPS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No VPS</SelectItem>
                {vpsList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                    {v.vps_number ? ` · ${v.vps_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Register number</Label>
            <Input
              value={register}
              onChange={(e) => setRegister(e.target.value)}
              placeholder="e.g. 1042"
            />
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
            <Label className="text-xs text-muted-foreground">Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="What is this result?"
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
              <TableHead>Register number</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dayRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No profit or loss recorded on {date}.
                </TableCell>
              </TableRow>
            )}
            {dayRows.map((r) => {
              const signed = r.direction === "loss" ? -Number(r.amount) : Number(r.amount);
              return (
                <TableRow key={r.id}>
                  <TableCell>{vpsName(r.vps_id)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.register_number ?? "—"}</TableCell>
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
              <TableCell colSpan={3} className="font-semibold">
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
      </CardContent>
    </Card>
  );
}
