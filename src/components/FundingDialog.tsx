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

export function FundingDialog({
  open,
  onOpenChange,
  accounts,
  wallets,
  vpsList = [],
  initial,
  onSubmit,
  suggestedBalance,
  walletBalanceOf,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: Account[];
  wallets: Named[];
  vpsList?: Vps[];
  initial?: Row | null;
  onSubmit: (values: Row) => void;
  suggestedBalance?: (accountId: string) => number | null;
  walletBalanceOf?: (walletId: string) => number | null;
}) {
  const [kind, setKind] = useState<"deposit" | "redeposit">("deposit");
  const [date, setDate] = useState("");
  const [walletId, setWalletId] = useState("");

  // target side
  const [vpsId, setVpsId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [before, setBefore] = useState("");
  const [amount, setAmount] = useState("");

  // source side (redeposit only)
  const [fromVpsId, setFromVpsId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [fromBefore, setFromBefore] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const acc = String(initial?.["account_id"] ?? "");
    setKind((initial?.["kind"] as "deposit" | "redeposit") ?? "deposit");
    setDate(String(initial?.["event_date"] ?? ""));
    setWalletId(String(initial?.["payment_source_id"] ?? wallets[0]?.id ?? ""));
    setVpsId(String(accounts.find((a) => a.id === acc)?.vps_id ?? ""));
    setAccountId(acc);
    const sug = acc ? suggestedBalance?.(acc) : null;
    setBefore(sug != null ? String(sug) : "");
    setAmount("");
    setFromVpsId("");
    setFromAccountId("");
    setFromBefore("");
    setWithdrawAmount("");
    setNote("");
  }, [open, initial, wallets, accounts, suggestedBalance]);

  const vpsLabel = (v: Vps) => (v.vps_number ? `VPS ${v.vps_number} — ${v.name}` : v.name);
  const label = (a: Account) => `${a.broker} ${a.account_name}`;
  const onVps = (id: string) => accounts.filter((a) => String(a.vps_id ?? "") === id);

  const targetAccounts = vpsId ? onVps(vpsId) : accounts;
  const sourceAccounts = (fromVpsId ? onVps(fromVpsId) : accounts).filter(
    (a) => a.id !== accountId,
  );

  const beforeN = num(before);
  const amountN = num(amount);
  const afterN = beforeN != null && amountN != null ? beforeN + amountN : null;

  const fromBeforeN = num(fromBefore);
  const withdrawN = num(withdrawAmount);
  const fromAfter = fromBeforeN != null && withdrawN != null ? fromBeforeN - withdrawN : null;

  const walletNow = walletId ? walletBalanceOf?.(walletId) ?? null : null;
  const walletAfterWithdraw = walletNow == null ? null : walletNow + (withdrawN ?? 0);
  const walletDelta =
    kind === "deposit" ? -(amountN ?? 0) : (withdrawN ?? 0) - (amountN ?? 0);
  const walletAfter = walletNow == null ? null : walletNow + walletDelta;

  // Pick the paired account on the same VPS: the other broker (HFM <-> Rickmil).
  const pickPaired = (sourceId: string) => {
    const src = accounts.find((a) => a.id === sourceId);
    if (!src) return null;
    const sameVps = accounts.filter(
      (a) => a.id !== sourceId && String(a.vps_id ?? "") === String(src.vps_id ?? ""),
    );
    return (
      sameVps.find((a) => a.broker.toLowerCase() !== src.broker.toLowerCase()) ??
      sameVps[0] ??
      null
    );
  };

  const chooseSource = (v: string) => {
    setFromAccountId(v);
    const sug = suggestedBalance?.(v);
    setFromBefore(sug != null ? String(sug) : "");
    const paired = pickPaired(v);
    if (paired) {
      setVpsId(String(paired.vps_id ?? ""));
      setAccountId(paired.id);
      const psug = suggestedBalance?.(paired.id);
      setBefore(psug != null ? String(psug) : "");
    }
  };

  const valid = Boolean(
    accountId &&
      date &&
      walletId &&
      amountN != null &&
      amountN > 0 &&
      (kind === "deposit" || (fromAccountId && withdrawN != null && withdrawN > 0)),
  );

  const submit = () =>
    onSubmit({
      account_id: accountId,
      kind,
      event_date: date,
      amount: amountN,
      source_type: kind === "deposit" ? "wallet" : "account",
      payment_source_id: walletId,
      from_account_id: kind === "redeposit" ? fromAccountId : null,
      from_balance_before: kind === "redeposit" ? fromBeforeN : null,
      from_balance_after: kind === "redeposit" ? fromAfter : null,
      balance_before: beforeN,
      balance_after: afterN,
      has_fee: false,
      fee: 0,
      note: note || null,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === "deposit" ? "Direct deposit" : "Redeposit"}</DialogTitle>
          <DialogDescription>
            {kind === "deposit"
              ? "Money leaves the wallet and lands in the account you pick."
              : "Money is withdrawn from one account into the wallet, then deposited into another account."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "deposit" | "redeposit")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Direct deposit (wallet → account)</SelectItem>
                <SelectItem value="redeposit">Redeposit (account → wallet → account)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {kind === "redeposit" && (
            <>
              <div className="col-span-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step 1 — withdraw from an account
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">VPS number (from)</Label>
                <Select
                  value={fromVpsId}
                  onValueChange={(v) => {
                    setFromVpsId(v);
                    setFromAccountId("");
                    setFromBefore("");
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
                <Label className="text-xs text-muted-foreground">From account</Label>
                <Select value={fromAccountId} onValueChange={chooseSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {label(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Balance before withdraw</Label>
                <Input
                  type="number"
                  step="any"
                  value={fromBefore}
                  onChange={(e) => setFromBefore(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Withdraw amount</Label>
                <Input
                  type="number"
                  step="any"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <div className="col-span-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                Balance after withdraw:{" "}
                <span className="font-mono">{fromAfter == null ? "—" : money(fromAfter)}</span>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Withdraw to wallet</Label>
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
              <div className="col-span-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                Wallet {wallets.find((w) => w.id === walletId)?.name ?? "—"} after withdraw:{" "}
                <span className="font-mono">{walletNow == null ? "—" : money(walletNow)}</span>
                <span className="mx-2">→</span>
                <span className="font-mono font-semibold">
                  {walletAfterWithdraw == null ? "—" : money(walletAfterWithdraw)}
                </span>
              </div>
            </>
          )}

          <div className="col-span-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {kind === "redeposit" ? "Step 2 — deposit into another account" : "Deposit"}
          </div>

          {kind === "deposit" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Wallet</Label>
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
          )}


          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">VPS number (to)</Label>
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

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              To account {vpsId ? "(accounts on this VPS)" : ""}
            </Label>
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
                {targetAccounts
                  .filter((a) => a.id !== fromAccountId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {label(a)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Balance before deposit</Label>
            <Input
              type="number"
              step="any"
              value={before}
              onChange={(e) => setBefore(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Deposit amount</Label>
            <Input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="col-span-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            Balance after deposit:{" "}
            <span className="font-mono">{afterN == null ? "—" : money(afterN)}</span>
          </div>

          <div className="col-span-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            Wallet {wallets.find((w) => w.id === walletId)?.name ?? "—"}:{" "}
            <span className="font-mono">{walletNow == null ? "—" : money(walletNow)}</span>
            <span className="mx-2">→</span>
            <span className="font-mono font-semibold">
              {walletAfter == null ? "—" : money(walletAfter)}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {kind === "deposit"
                ? "the deposit is taken out of the wallet"
                : "the withdrawal goes in, the deposit goes out"}
            </span>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Save record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
