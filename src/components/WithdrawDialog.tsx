import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, type Account, type Named, type Row, type Vps } from "@/lib/db";

const num = (v: string) => (v === "" ? null : Number(v));

export function WithdrawDialog({
  open,
  onOpenChange,
  accounts,
  wallets,
  vpsList = [],
  date,
  initialAccountId,
  suggestedBalance,
  walletBalanceOf,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: Account[];
  wallets: Named[];
  vpsList?: Vps[];
  date: string;
  initialAccountId?: string | null;
  suggestedBalance?: (accountId: string) => number | null;
  walletBalanceOf?: (walletId: string) => number | null;
  onSubmit: (values: Row) => void;
}) {
  const [vpsId, setVpsId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [eventDate, setEventDate] = useState(date);
  const [before, setBefore] = useState("");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const acc = String(initialAccountId ?? "");
    setAccountId(acc);
    setVpsId(String(accounts.find((a) => a.id === acc)?.vps_id ?? ""));
    setEventDate(date);
    const sug = acc ? suggestedBalance?.(acc) : null;
    setBefore(sug != null ? String(sug) : "");
    setAmount("");
    setWalletId(String(wallets[0]?.id ?? ""));
    setNote("");
  }, [open, initialAccountId, date, accounts, wallets, suggestedBalance]);

  const vpsAccounts = vpsId ? accounts.filter((a) => String(a.vps_id ?? "") === vpsId) : accounts;
  const vpsLabel = (v: Vps) => (v.vps_number ? `VPS ${v.vps_number} — ${v.name}` : v.name);
  const label = (a: Account) => `${a.broker} ${a.account_name}`;

  const beforeN = num(before);
  const amountN = num(amount);
  const afterN = beforeN != null && amountN != null ? beforeN - amountN : null;
  const valid = Boolean(accountId && eventDate && amountN != null && amountN > 0 && walletId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Withdraw from account</DialogTitle>
          <DialogDescription>
            Money leaves the trading account and lands in the wallet you pick, so the wallet balance
            goes up straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">VPS number</Label>
            <Select
              value={vpsId}
              onValueChange={(v) => {
                setVpsId(v);
                setAccountId("");
                setBefore("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select VPS..." />
              </SelectTrigger>
              <SelectContent>
                {vpsList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {vpsLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Account</Label>
            <Select
              value={accountId}
              onValueChange={(v) => {
                setAccountId(v);
                const sug = suggestedBalance?.(v);
                setBefore(sug != null ? String(sug) : "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {vpsAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {label(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Last balance</Label>
            <Input
              type="number"
              value={before}
              onChange={(e) => setBefore(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Withdraw amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To wallet</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger>
                <SelectValue placeholder="Select wallet..." />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Balance left</Label>
            <Input readOnly value={afterN == null ? "" : afterN.toFixed(2)} className="bg-muted/50" />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div className="col-span-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            Wallet {wallets.find((w) => w.id === walletId)?.name ?? "—"}:{" "}
            <span className="font-mono">
              {walletId && walletBalanceOf?.(walletId) != null
                ? money(walletBalanceOf(walletId))
                : "—"}
            </span>
            <span className="mx-2">→</span>
            <span className="font-mono font-semibold">
              {walletId && walletBalanceOf?.(walletId) != null
                ? money((walletBalanceOf(walletId) as number) + (amountN ?? 0))
                : "—"}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              the withdrawal is added to the wallet
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSubmit({
                account_id: accountId,
                kind: "withdraw",
                event_date: eventDate,
                amount: amountN,
                source_type: "wallet",
                payment_source_id: walletId,
                from_account_id: null,
                balance_before: beforeN,
                balance_after: afterN,
                has_fee: false,
                fee: 0,
                note: note || null,
              })
            }
          >
            Save withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
