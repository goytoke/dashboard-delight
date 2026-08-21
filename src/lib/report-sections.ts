import type { Sheet } from "@/lib/export";
import {
  walletBalance,
  walletLedger,
  type Cost,
  type FundingEvent,
  type Movement,
  type Named,
  type Transaction,
} from "@/lib/db";

export type MoneyContext = {
  wallets: Named[];
  costs: Cost[];
  funding: FundingEvent[];
  transactions: Transaction[];
  movements: Movement[];
  accountLabel: (id: string | null | undefined) => string;
  walletName: (id: string | null | undefined) => string;
};

const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

/** Balance of every wallet counting only what happened up to (and including) `asOf`. */
export function walletClosings(asOf: string, ctx: MoneyContext) {
  return ctx.wallets.map((w) => {
    const ledger = walletLedger(w, {
      costs: ctx.costs,
      funding: ctx.funding,
      transactions: ctx.transactions,
      accountLabel: (id) => ctx.accountLabel(id),
    });
    const upTo = ledger.filter((e) => e.date <= asOf);
    const closing = walletBalance(w, upTo);
    const moved = upTo.reduce((s, e) => s + e.delta, 0);
    return { wallet: w, closing, moved, entries: upTo };
  });
}

export function binanceClosing(asOf: string, ctx: MoneyContext) {
  const all = walletClosings(asOf, ctx);
  return all.find((x) => x.wallet.name.toLowerCase().includes("binance")) ?? null;
}

/**
 * Money sheets shared by the daily and the weekly report:
 * withdrawals, direct deposits, redeposits, costs, movements and wallet
 * closing balances (Binance included). Empty sections explain why.
 */
export function moneySheets(
  from: string,
  to: string,
  label: string,
  ctx: MoneyContext,
): Sheet[] {
  const funding = ctx.funding.filter((f) => inRange(f.event_date, from, to));
  const withdrawals = funding.filter((f) => f.kind === "withdraw");
  const deposits = funding.filter((f) => f.kind === "deposit");
  const redeposits = funding.filter((f) => f.kind === "redeposit");
  const costs = ctx.costs.filter((c) => inRange(c.cost_date, from, to));
  const movements = ctx.movements.filter((m) => inRange(m.move_date, from, to));
  const closings = walletClosings(to, ctx);

  const num = (v: unknown) => Number(v ?? 0);
  const note = (columns: string[], text: string) => [
    text,
    ...columns.slice(1).map(() => ""),
  ];

  const withdrawCols = ["Account", "Date", "Amount", "Wallet it landed in", "Fee", "Balance after"];
  const depositCols = ["Account", "Date", "Amount", "Wallet it came from", "Balance after"];
  const redepositCols = ["Account", "Date", "Amount", "Withdrawn from", "Wallet used", "Balance after"];
  const costCols = ["Date", "Reason", "Wallet", "Amount"];
  const movementCols = ["Date", "From", "To", "Wallet", "Withdrawn", "Extra", "Deposited", "New opening"];
  const walletCols = ["Wallet", "Starting balance", "Change up to date", "Closing balance"];

  return [
    {
      title: `Withdrawals — ${label}`,
      columns: withdrawCols,
      rows: withdrawals.length
        ? withdrawals.map((f) => [
            ctx.accountLabel(f.account_id),
            f.event_date,
            num(f.amount),
            ctx.walletName(f.payment_source_id),
            num(f.fee),
            f.balance_after ?? "",
          ])
        : [
            note(
              withdrawCols,
              "No withdrawal in this period — no money was pulled out of an account into a wallet.",
            ),
          ],
    },
    {
      title: `Direct deposits — ${label}`,
      columns: depositCols,
      rows: deposits.length
        ? deposits.map((f) => [
            ctx.accountLabel(f.account_id),
            f.event_date,
            num(f.amount),
            ctx.walletName(f.payment_source_id),
            f.balance_after ?? "",
          ])
        : [
            note(
              depositCols,
              "No direct deposit in this period — no fresh money was pushed from a wallet into an account.",
            ),
          ],
    },
    {
      title: `Redeposits — ${label}`,
      columns: redepositCols,
      rows: redeposits.length
        ? redeposits.map((f) => [
            ctx.accountLabel(f.account_id),
            f.event_date,
            num(f.amount),
            f.from_account_id ? ctx.accountLabel(f.from_account_id) : "",
            ctx.walletName(f.payment_source_id),
            f.balance_after ?? "",
          ])
        : [
            note(
              redepositCols,
              "No redeposit in this period — nothing withdrawn earlier was put back into an account.",
            ),
          ],
    },
    {
      title: `Costs — ${label}`,
      columns: costCols,
      rows: costs.length
        ? costs.map((c) => [
            c.cost_date,
            c.reason,
            ctx.walletName(c.payment_source_id),
            num(c.amount),
          ])
        : [note(costCols, "No cost in this period — nothing was spent out of any wallet.")],
    },
    {
      title: `Movements — ${label}`,
      columns: movementCols,
      rows: movements.length
        ? movements.map((m) => [
            m.move_date,
            ctx.accountLabel(m.from_account_id),
            ctx.accountLabel(m.to_account_id),
            ctx.walletName(m.payment_source_id),
            num(m.withdraw_amount),
            num(m.extra_amount),
            num(m.deposit_amount),
            m.to_balance_after ?? "",
          ])
        : [
            note(
              movementCols,
              "No movement in this period — no balance was relocated from one account to another, so the net is untouched by movements.",
            ),
          ],
    },
    {
      title: `Wallet closing balances as of ${to}`,
      columns: walletCols,
      rows: closings.length
        ? closings.map((c) => [
            c.wallet.name,
            Number(c.wallet.starting_balance ?? 0),
            Number(c.moved.toFixed(2)),
            Number(c.closing.toFixed(2)),
          ])
        : [note(walletCols, "No wallet recorded yet.")],
    },
  ];
}

export function moneyTheory(from: string, to: string, ctx: MoneyContext) {
  const funding = ctx.funding.filter((f) => inRange(f.event_date, from, to));
  const sum = (list: FundingEvent[]) => list.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const withdrawals = sum(funding.filter((f) => f.kind === "withdraw"));
  const deposits = sum(funding.filter((f) => f.kind === "deposit"));
  const redeposits = sum(funding.filter((f) => f.kind === "redeposit"));
  const costs = ctx.costs
    .filter((c) => inRange(c.cost_date, from, to))
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const movements = ctx.movements.filter((m) => inRange(m.move_date, from, to));
  const moved = movements.reduce((s, m) => s + Number(m.deposit_amount ?? 0), 0);
  const binance = binanceClosing(to, ctx);

  const lines = [
    binance
      ? `Binance last closed balance as of ${to}: ${binance.closing.toFixed(2)} (started at ${Number(
          binance.wallet.starting_balance ?? 0,
        ).toFixed(2)}, changed by ${binance.moved.toFixed(2)}).`
      : "No Binance wallet is recorded, so no Binance closing balance can be shown.",
    `Withdrawals ${withdrawals.toFixed(2)}, direct deposits ${deposits.toFixed(2)}, redeposits ${redeposits.toFixed(2)}, costs ${costs.toFixed(2)}.`,
  ];

  lines.push(
    movements.length
      ? `Movements ${moved.toFixed(2)} across ${movements.length} transfer(s) between accounts — money changed place, not amount, so the net stays the same.`
      : "No movement recorded in this period, because no balance was shifted from one account to another; every account kept its own money.",
  );

  return lines;
}

/** Balance of a wallet as of a date (null when that wallet does not exist). */
function walletAt(name: string, asOf: string, ctx: MoneyContext) {
  const hit = walletClosings(asOf, ctx).find((x) =>
    x.wallet.name.toLowerCase().includes(name),
  );
  return hit ? hit.closing : null;
}

export type GrandTotals = {
  activeOpening: number;
  activeClosing: number;
  reserveOpening: number;
  reserveClosing: number;
  binanceOpening: number;
  binanceClosing: number;
  grandOpening: number;
  grandClosing: number;
  net: number;
};

/**
 * Grand opening/closing across active accounts, reserve accounts and the
 * Binance wallet, plus the net between them (negative or positive).
 */
export function grandTotals(
  date: string,
  ctx: MoneyContext,
  rows: { status: string; opening: number | null; closing: number | null }[],
): GrandTotals {
  const sum = (status: string, key: "opening" | "closing") =>
    rows.filter((r) => r.status === status).reduce((s, r) => s + (r[key] ?? 0), 0);

  const prev = new Date(new Date(`${date}T00:00:00`).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  const activeOpening = sum("active", "opening");
  const activeClosing = sum("active", "closing");
  const reserveOpening = sum("reserve", "opening");
  const reserveClosing = sum("reserve", "closing");
  const binanceOpening = walletAt("binance", prev, ctx) ?? 0;
  const binanceClosingBal = walletAt("binance", date, ctx) ?? 0;

  const grandOpening = activeOpening + reserveOpening + binanceOpening;
  const grandClosing = activeClosing + reserveClosing + binanceClosingBal;

  return {
    activeOpening,
    activeClosing,
    reserveOpening,
    reserveClosing,
    binanceOpening,
    binanceClosing: binanceClosingBal,
    grandOpening,
    grandClosing,
    net: grandClosing - grandOpening,
  };
}

export function grandTotalSheet(date: string, t: GrandTotals): Sheet {
  return {
    title: `Grand totals — ${date}`,
    columns: ["Group", "Opening balance", "Closing balance", "Change"],
    rows: [
      ["Active accounts", t.activeOpening, t.activeClosing, Number((t.activeClosing - t.activeOpening).toFixed(2))],
      ["Reserve accounts", t.reserveOpening, t.reserveClosing, Number((t.reserveClosing - t.reserveOpening).toFixed(2))],
      ["Binance wallet", t.binanceOpening, t.binanceClosing, Number((t.binanceClosing - t.binanceOpening).toFixed(2))],
      ["GRAND TOTAL", Number(t.grandOpening.toFixed(2)), Number(t.grandClosing.toFixed(2)), Number(t.net.toFixed(2))],
    ],
  };
}
