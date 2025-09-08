#!/usr/bin/env python3
# Minimal TUI-like wizard to record weekly trades and update:
#  - holdings.csv / crypto_holdings.csv
#  - data/entries.json / data/crypto_entries.json
#
# No external libraries. Works for BOTH equities and crypto.
#
# Usage:
#   python3 ledger_tui.py
#
# Notes:
# - For each trade you can input either:
#     (A) unit price (CAD per share/coin), or
#     (B) TOTAL CAD (incl. fees/spread) → script computes effective unit price.
# - Holdings math is deterministic (weighted-average cost). Sells reduce qty.
# - Files are created if missing; previous holdings are backed up with a .bak-<timestamp>.

import json, csv, sys, os, time
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta

D = lambda x: Decimal(str(x))
QTY_PREC = Decimal("0.000000")   # 6 dp for shares/coins
PX_PREC  = Decimal("0.0001")     # 4 dp for avg_cost; entries store raw floats

# ---------- IO helpers
def ensure_parent(path: Path):
    if path.parent and not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)

def backup_file(path: Path):
    if path.exists():
        ts = time.strftime("%Y%m%d-%H%M%S")
        path.rename(path.with_name(path.name + f".bak-{ts}"))

def rounded_qty(x):  return D(x).quantize(QTY_PREC,  rounding=ROUND_HALF_UP)
def rounded_px(x):   return D(x).quantize(PX_PREC,   rounding=ROUND_HALF_UP)

def clear(): 
    try:
        os.system("clear" if os.name != "nt" else "cls")
    except Exception:
        pass

def pause(msg="Press Enter to continue…"):
    try:
        input(msg)
    except EOFError:
        pass

# ---------- default paths
def defaults_for(asset: str):
    if asset == "equity":
        return Path("holdings.csv"), Path("data/entries.json")
    else:
        return Path("crypto_holdings.csv"), Path("data/crypto_entries.json")

def init_files_if_needed(holdings: Path, entries: Path, asset: str):
    ensure_parent(holdings)
    ensure_parent(entries)
    if not holdings.exists():
        with holdings.open("w", newline="") as f:
            if asset == "equity":
                csv.writer(f).writerow(["ticker","shares","avg_cost","currency"])
            else:
                csv.writer(f).writerow(["symbol","amount","avg_cost_cad"])
    if not entries.exists():
        entries.write_text("[]")

# ---------- holdings load/save
def load_holdings(holdings: Path, asset: str):
    rows = []
    if not holdings.exists():
        return rows
    with holdings.open(newline="") as f:
        r = csv.DictReader(f)
        if asset == "equity":
            req = ("ticker","shares","avg_cost","currency")
        else:
            req = ("symbol","amount","avg_cost_cad")
        miss = [c for c in req if c not in r.fieldnames]
        if miss:
            print(f"ERROR: holdings CSV missing columns: {miss}"); sys.exit(1)
        for row in r:
            if asset == "equity":
                rows.append({
                    "ticker": row["ticker"].strip().upper(),
                    "shares": D(row["shares"]),
                    "avg_cost": D(row["avg_cost"]),
                    "currency": row["currency"].strip().upper()
                })
            else:
                rows.append({
                    "symbol": row["symbol"].strip().upper(),
                    "amount": D(row["amount"]),
                    "avg_cost_cad": D(row["avg_cost_cad"])
                })
    return rows

def save_holdings(holdings: Path, rows, asset: str):
    backup_file(holdings)
    with holdings.open("w", newline="") as f:
        if asset == "equity":
            fields = ["ticker","shares","avg_cost","currency"]
        else:
            fields = ["symbol","amount","avg_cost_cad"]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in sorted(rows, key=lambda x: (x.get("ticker") or x.get("symbol"))):
            out = dict(r)
            # serialize Decimals
            for k,v in out.items():
                if isinstance(v, Decimal):
                    out[k] = str(v)
            w.writerow(out)

# ---------- entries load/append
def load_entries(entries: Path):
    try:
        return json.loads(entries.read_text()) if entries.exists() else []
    except Exception as e:
        print(f"ERROR reading entries JSON: {e}"); sys.exit(1)

def append_entry(entries: Path, entry: dict):
    data = load_entries(entries)
    data.append(entry)
    entries.write_text(json.dumps(data, indent=2))

# ---------- week date helpers
def nearest_sunday_today():
    today = date.today()
    # If today is Sunday, use today; else next Sunday
    return today if today.weekday() == 6 else (today + timedelta(days=(6 - today.weekday())))

# ---------- math
def apply_equity(holdings_rows, trades):
    idx = {r["ticker"]: r for r in holdings_rows}
    for t in trades:
        action = t["action"]; ticker = t["ticker"]; qty = D(t["qty"])
        px = D(t["unit_price"]); cur = t["currency"]
        if action == "buy":
            row = idx.get(ticker)
            if row:
                if row["currency"] != cur:
                    raise ValueError(f"Currency mismatch for {ticker}")
                new_sh = row["shares"] + qty
                new_cost = ((row["shares"]*row["avg_cost"]) + (qty*px)) / new_sh
                row["shares"]   = rounded_qty(new_sh)
                row["avg_cost"] = rounded_px(new_cost)
            else:
                idx[ticker] = {
                    "ticker": ticker,
                    "shares": rounded_qty(qty),
                    "avg_cost": rounded_px(px),
                    "currency": cur
                }
        else:
            row = idx.get(ticker)
            if not row: raise ValueError(f"Selling non-existent holding {ticker}")
            if qty > row["shares"]:
                raise ValueError(f"Sell qty {qty} exceeds holding {row['shares']} for {ticker}")
            row["shares"] = rounded_qty(row["shares"] - qty)
            if row["shares"] == 0: del idx[ticker]
    return list(idx.values())

def apply_crypto(holdings_rows, trades):
    idx = {r["symbol"]: r for r in holdings_rows}
    for t in trades:
        action = t["action"]; sym = t["symbol"]; amt = D(t["qty"])
        px = D(t["unit_price"])
        if action == "buy":
            row = idx.get(sym)
            if row:
                new_amt = row["amount"] + amt
                new_cost = ((row["amount"]*row["avg_cost_cad"]) + (amt*px)) / new_amt
                row["amount"]       = rounded_qty(new_amt)
                row["avg_cost_cad"] = rounded_px(new_cost)
            else:
                idx[sym] = {
                    "symbol": sym,
                    "amount": rounded_qty(amt),
                    "avg_cost_cad": rounded_px(px)
                }
        else:
            row = idx.get(sym)
            if not row: raise ValueError(f"Selling non-existent holding {sym}")
            if amt > row["amount"]:
                raise ValueError(f"Sell amount {amt} exceeds holding {row['amount']} for {sym}")
            row["amount"] = rounded_qty(row["amount"] - amt)
            if row["amount"] == 0: del idx[sym]
    return list(idx.values())

# ---------- TUI helpers (plain-text wizard)
def prompt(msg, default=None, to_upper=False):
    if default is None:
        val = input(f"{msg}: ").strip()
    else:
        val = input(f"{msg} [{default}]: ").strip()
        if val == "": val = str(default)
    if to_upper: val = val.upper()
    return val

def prompt_float(msg, default=None):
    while True:
        v = prompt(msg, default)
        try:
            return float(v)
        except Exception:
            print("  Not a number. Try again.")

def prompt_choice(msg, choices):
    # choices: list of (key, label)
    keys = "/".join(k for k,_ in choices)
    while True:
        v = prompt(f"{msg} ({keys})").lower()
        for k,_ in choices:
            if v == k: return k
        print("  Invalid choice.")

def add_trades_loop(asset: str):
    trades = []
    print("\nEnter trades (leave action blank to finish).")
    while True:
        act = prompt("Action (buy/sell, blank to end)").lower()
        if act == "": break
        if act not in ("buy","sell"):
            print("  Must be 'buy' or 'sell'."); continue
        if asset == "equity":
            sym = prompt("Ticker (e.g., ABX.TO)", to_upper=True)
            qty = prompt_float("Quantity (shares)")
            how = prompt_choice("Price input", [("u","unit price CAD"),("t","TOTAL CAD incl. fees")])
            if how == "u":
                unit = prompt_float("Unit price CAD")
            else:
                total = prompt_float("TOTAL CAD (incl. fees)")
                unit = total / qty
            cur = prompt("Currency (CAD/USD)", default="CAD", to_upper=True)
            trades.append({"action": act, "ticker": sym, "qty": qty, "unit_price": unit, "currency": cur})
        else:
            sym = prompt("Symbol (e.g., BTC, DOGE)", to_upper=True)
            qty = prompt_float("Amount (coins)")
            how = prompt_choice("Price input", [("u","unit price CAD"),("t","TOTAL CAD incl. fees")])
            if how == "u":
                unit = prompt_float("Unit price CAD")
            else:
                total = prompt_float("TOTAL CAD (incl. fees)")
                unit = total / qty
            trades.append({"action": act, "symbol": sym, "qty": qty, "unit_price": unit})
        print(f"  Added: {act} {sym} {qty} @ {unit:.6f} CAD")
    return trades

def main():
    clear()
    print("=== Weekly Ledger Wizard ===\n")
    asset_key = prompt_choice("Which book to update?", [("e","equity"),("c","crypto")])
    asset = "equity" if asset_key == "e" else "crypto"

    holdings_path, entries_path = defaults_for(asset)
    print(f"\nFiles (default):\n  Holdings: {holdings_path}\n  Entries:  {entries_path}")
    if prompt_choice("Use these?", [("y","yes"),("n","no")]) == "n":
        holdings_path = Path(prompt("Holdings CSV path", holdings_path))
        entries_path  = Path(prompt("Entries JSON path", entries_path))

    init_files_if_needed(holdings_path, entries_path, asset)

    # Week & deposit
    default_week = nearest_sunday_today().isoformat()
    wk = prompt("Week start (YYYY-MM-DD)", default_week)
    dep = prompt_float("Deposit this week (CAD)", default=0)

    # Collect trades
    trades = add_trades_loop(asset)

    # Show summary
    clear()
    print("=== Review ===")
    print(f"Asset: {asset}")
    print(f"Week : {wk}")
    print(f"Deposit CAD: {dep:.2f}")
    if not trades:
        print("Trades: (none)")
    else:
        print("Trades:")
        if asset == "equity":
            for t in trades:
                print(f"  {t['action']} {t['ticker']} {t['qty']} @ {t['unit_price']:.6f} {t['currency']}")
        else:
            for t in trades:
                print(f"  {t['action']} {t['symbol']} {t['qty']} @ {t['unit_price']:.6f} CAD")

    if prompt_choice("Proceed to write files?", [("y","yes"),("n","no")]) != "y":
        print("Aborted. No changes written."); return

    # Load holdings and apply
    holds = load_holdings(holdings_path, asset)
    try:
        if asset == "equity":
            updated = apply_equity(holds, trades)
        else:
            updated = apply_crypto(holds, trades)
    except ValueError as e:
        print(f"\nERROR: {e}\nNo changes written.")
        return

    # Save holdings
    save_holdings(holdings_path, updated, asset)

    # Append entries
    entry_trades = []
    if asset == "equity":
        for t in trades:
            entry_trades.append({
                "action": t["action"], "ticker": t["ticker"], "qty": float(t["qty"]),
                "price": float(t["unit_price"]), "currency": t["currency"]
            })
    else:
        for t in trades:
            entry_trades.append({
                "action": t["action"], "symbol": t["symbol"], "qty": float(t["qty"]),
                "price": float(t["unit_price"])
            })
    append_entry(entries_path, {
        "week_start": wk,
        "deposit_cad": round(float(dep), 2),
        "trades": entry_trades
    })

    print("\n✅ Done.")
    print(f"  Updated holdings → {holdings_path}")
    print(f"  Appended entry   → {entries_path}\n")
    pause()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
