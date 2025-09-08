#!/usr/bin/env python3
"""
Record a weekly investing entry and update holdings (equity OR crypto).

- Reads executed fills (CSV or interactive prompts)
- Updates/creates holdings CSV (weighted avg cost, supports fractionals)
- Appends an entry to entries.json for your public site

Usage examples:

# Equities (ABX.TO fractional buy)
python3 record_week.py --asset equity \
  --week 2025-09-07 --deposit 10 \
  --fills fills_equity.csv \
  --holdings holdings.csv \
  --entries data/entries.json \
  --notes "Week 1 kickoff"

# Crypto (5 coins)
python3 record_week.py --asset crypto \
  --week 2025-09-07 --deposit 10 \
  --fills fills_crypto.csv \
  --holdings crypto_holdings.csv \
  --entries data/crypto_entries.json

# Interactive mode (no --fills): the script will prompt you trade-by-trade
python3 record_week.py --asset equity --week 2025-09-14 --deposit 11 --holdings holdings.csv --entries data/entries.json
"""

import argparse, csv, json, sys, os
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP

D = lambda x: Decimal(str(x))

def round_qty(x):    return D(x).quantize(Decimal("0.000000"), rounding=ROUND_HALF_UP)
def round_price(x):  return D(x).quantize(Decimal("0.0001"),   rounding=ROUND_HALF_UP)

def die(msg): print(f"ERROR: {msg}", file=sys.stderr); sys.exit(1)

def ensure_parent(path: Path):
    if path.parent and not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)

# ---------- Load/save holdings
def load_holdings(path: Path, asset: str):
    rows = []
    if not path.exists():
        return rows
    with path.open(newline="") as f:
        r = csv.DictReader(f)
        if asset == "equity":
            req = ("ticker","shares","avg_cost","currency")
        else:
            req = ("symbol","amount","avg_cost_cad")
        miss = [c for c in req if c not in r.fieldnames]
        if miss: die(f"holdings CSV missing columns: {miss}")
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

def write_holdings(path: Path, rows, asset: str):
    ensure_parent(path)
    if asset == "equity":
        fields = ["ticker","shares","avg_cost","currency"]
    else:
        fields = ["symbol","amount","avg_cost_cad"]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in sorted(rows, key=lambda x: (x.get("ticker") or x.get("symbol"))):
            out = {}
            for k in fields:
                v = r[k]
                out[k] = str(v)
            w.writerow(out)

# ---------- Load/add site entries.json
def load_entries(path: Path):
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text())
        if isinstance(data, list): return data
        die("entries file exists but is not a JSON array")
    except Exception as e:
        die(f"failed to read entries JSON: {e}")

def append_entry(path: Path, entry: dict):
    ensure_parent(path)
    data = load_entries(path)
    data.append(entry)
    path.write_text(json.dumps(data, indent=2))

# ---------- Fills input
def load_fills_csv(path: Path, asset: str):
    rows = []
    with path.open(newline="") as f:
        r = csv.DictReader(f)
        if asset == "equity":
            req = ("action","ticker","qty","fill_price","currency")
        else:
            req = ("action","symbol","amount","fill_price_cad")
        miss = [c for c in req if c not in r.fieldnames]
        if miss: die(f"fills CSV missing columns: {miss}")

        for row in r:
            action = row["action"].strip().lower()
            if action not in ("buy","sell"): die(f"invalid action: {action}")
            if asset == "equity":
                rows.append({
                    "action": action,
                    "ticker": row["ticker"].strip().upper(),
                    "qty": D(row["qty"]),
                    "fill_price": D(row["fill_price"]),
                    "currency": row["currency"].strip().upper()
                })
            else:
                rows.append({
                    "action": action,
                    "symbol": row["symbol"].strip().upper(),
                    "amount": D(row["amount"]),
                    "fill_price_cad": D(row["fill_price_cad"])
                })
    return rows

def interactive_fills(asset: str):
    print("Enter executed trades one per line. Leave blank to finish.")
    if asset == "equity":
        print("Format: buy|sell TICKER QTY FILL_PRICE CURRENCY   e.g.  buy ABX.TO 0.25 39.37 CAD")
    else:
        print("Format: buy|sell SYMBOL AMOUNT FILL_PRICE_CAD      e.g.  buy BTC 0.0002 93000")
    rows = []
    while True:
        line = input("> ").strip()
        if not line: break
        parts = line.split()
        try:
            if asset == "equity":
                act, tic, q, p, cur = parts
                rows.append({
                    "action": act.lower(), "ticker": tic.upper(),
                    "qty": D(q), "fill_price": D(p), "currency": cur.upper()
                })
            else:
                act, sym, amt, p = parts
                rows.append({
                    "action": act.lower(), "symbol": sym.upper(),
                    "amount": D(amt), "fill_price_cad": D(p)
                })
        except Exception:
            print("Could not parse. Try again.")
            continue
    return rows

# ---------- Apply to holdings (weighted avg cost, sells reduce qty)
def index_by(rows, key): return {r[key]: r for r in rows}

def apply_equity(holdings, fills):
    idx = index_by(holdings, "ticker")
    for f in fills:
        tkr = f["ticker"]; action = f["action"]
        qty  = D(f["qty"]); price = D(f["fill_price"]); cur = f["currency"]
        if qty <= 0: die(f"non-positive qty for {tkr}")
        row = idx.get(tkr)
        if action == "buy":
            if row:
                if row["currency"] != cur: die(f"currency mismatch for {tkr}")
                new_sh = row["shares"] + qty
                new_cost = ((row["shares"]*row["avg_cost"]) + (qty*price)) / new_sh
                row["shares"]   = round_qty(new_sh)
                row["avg_cost"] = round_price(new_cost)
            else:
                idx[tkr] = {"ticker": tkr, "shares": round_qty(qty), "avg_cost": round_price(price), "currency": cur}
        else:  # sell
            if not row: die(f"selling non-existent holding {tkr}")
            if qty > row["shares"]: die(f"sell qty {qty} exceeds holding {row['shares']} for {tkr}")
            row["shares"] = round_qty(row["shares"] - qty)
            if row["shares"] == 0: del idx[tkr]
    return list(idx.values())

def apply_crypto(holdings, fills):
    idx = index_by(holdings, "symbol")
    for f in fills:
        sym = f["symbol"]; action = f["action"]
        amt  = D(f["amount"]); price = D(f["fill_price_cad"])
        if amt <= 0: die(f"non-positive amount for {sym}")
        row = idx.get(sym)
        if action == "buy":
            if row:
                new_amt  = row["amount"] + amt
                new_cost = ((row["amount"]*row["avg_cost_cad"]) + (amt*price)) / new_amt
                row["amount"]       = round_qty(new_amt)
                row["avg_cost_cad"] = round_price(new_cost)
            else:
                idx[sym] = {"symbol": sym, "amount": round_qty(amt), "avg_cost_cad": round_price(price)}
        else:  # sell
            if not row: die(f"selling non-existent holding {sym}")
            if amt > row["amount"]: die(f"sell amount {amt} exceeds holding {row['amount']} for {sym}")
            row["amount"] = round_qty(row["amount"] - amt)
            if row["amount"] == 0: del idx[sym]
    return list(idx.values())

# ---------- Convert fills -> site entry trades
def fills_to_entry_trades(fills, asset: str):
    out = []
    if asset == "equity":
        for f in fills:
            out.append({
                "action": f["action"],
                "ticker": f["ticker"],
                "qty": float(f["qty"]),
                "price": float(f["fill_price"]),
                "currency": f["currency"]
            })
    else:
        for f in fills:
            out.append({
                "action": f["action"],
                "symbol": f["symbol"],
                "qty": float(f["amount"]),
                "price": float(f["fill_price_cad"])
            })
    return out

def main():
    ap = argparse.ArgumentParser(description="Record weekly trades and update holdings + entries JSON")
    ap.add_argument("--asset", required=True, choices=["equity","crypto"], help="Which book to update")
    ap.add_argument("--week", required=True, help="ISO date (Sunday), e.g., 2025-09-07")
    ap.add_argument("--deposit", type=float, default=0.0, help="Weekly contribution (CAD)")
    ap.add_argument("--fills", type=str, default=None, help="CSV of executed fills (see README for schemas). If omitted, interactive mode.")
    ap.add_argument("--holdings", type=str, required=True, help="Path to holdings CSV to update/create")
    ap.add_argument("--entries", type=str, required=True, help="Path to entries.json (site data) to append")
    ap.add_argument("--notes", type=str, default="", help="Optional note for this week")
    args = ap.parse_args()

    asset = args.asset
    week  = args.week
    deposit = float(args.deposit)

    holds_path = Path(args.holdings)
    entries_path = Path(args.entries)

    # Load existing holdings
    holdings = load_holdings(holds_path, asset)

    # Fills
    if args.fills:
        fills = load_fills_csv(Path(args.fills), asset)
    else:
        fills = interactive_fills(asset)

    if not fills:
        print("No fills entered. You can still log a deposit-only week.")
    else:
        # Normalize action
        for f in fills:
            if f["action"] not in ("buy","sell"): die("invalid action in fills")

    # Apply to holdings
    if asset == "equity":
        updated = apply_equity(holdings, fills)
    else:
        updated = apply_crypto(holdings, fills)

    # Save holdings
    write_holdings(holds_path, updated, asset)

    # Append entry for your site
    entry = {
        "week_start": week,
        "deposit_cad": round(float(deposit), 2),
        "trades": fills_to_entry_trades(fills, asset),
    }
    if args.notes:
        entry["notes"] = args.notes

    append_entry(entries_path, entry)

    print(f"Updated holdings → {holds_path}")
    print(f"Appended weekly entry → {entries_path}")

if __name__ == "__main__":
    main()
