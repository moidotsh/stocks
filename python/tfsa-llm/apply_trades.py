#!/usr/bin/env python3
"""
Apply executed trades to holdings files (equities or crypto) deterministically.

Usage examples:
  # Equities
  python3 apply_trades.py --asset equity \
      --holdings holdings.csv \
      --trades trades_equity.json \
      --fills fills_equity.csv \
      --out holdings.csv

  # Crypto
  python3 apply_trades.py --asset crypto \
      --holdings crypto_holdings.csv \
      --trades trades_crypto.json \
      --fills fills_crypto.csv \
      --out crypto_holdings.csv
"""

import argparse, csv, json, sys, time
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

D = lambda x: Decimal(str(x))

def round_shares(x):  # support fractionals
    return D(x).quantize(Decimal("0.000000"), rounding=ROUND_HALF_UP)

def round_price(x):
    return D(x).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr); sys.exit(1)

def load_trades(trades_path, asset):
    data = json.loads(Path(trades_path).read_text())
    if "trades" not in data or not isinstance(data["trades"], list):
        die("trades JSON missing 'trades' array")
    key = "ticker" if asset == "equity" else "symbol"
    out = []
    for t in data["trades"]:
        act = t.get("action","").lower()
        if act not in ("buy","sell"): die(f"invalid action in trades: {act}")
        sym = t.get(key)
        if not sym: die(f"missing {key} in trade")
        qty = t.get("qty")
        if qty is None: die("missing qty in trade")
        out.append({"action":act, key: str(sym).strip().upper(), "qty": D(qty)})
    return out

def load_fills(fills_path, asset):
    rows = []
    with open(fills_path, newline="") as f:
        r = csv.DictReader(f)
        req = ("action","ticker","qty","fill_price","currency") if asset=="equity" \
              else ("action","symbol","amount","fill_price_cad")
        miss = [c for c in req if c not in r.fieldnames]
        if miss: die(f"fills CSV missing columns: {miss}")
        for row in r:
            action = row["action"].strip().lower()
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

def load_holdings(holdings_path, asset):
    rows = []
    with open(holdings_path, newline="") as f:
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

def index_holdings(rows, key):
    return {row[key]: row for row in rows}

def apply_equity(holdings, trades, fills):
    hidx = index_holdings(holdings, "ticker")
    # group fills by (action,ticker)
    fidx = {}
    for f in fills:
        k = (f["action"], f["ticker"])
        fidx.setdefault(k, []).append(f)

    for t in trades:
        k = ("qty", "ticker")
        action, ticker, qty = t["action"], t["ticker"], D(t["qty"])
        fills_here = fidx.get((action, ticker), [])
        if not fills_here:
            die(f"no fill provided for trade {action} {ticker}")

        # If multiple partial fills exist, weight the average fill price
        total_qty = sum((f["qty"] for f in fills_here), D(0))
        if total_qty != qty:
            die(f"fills qty {total_qty} != trade qty {qty} for {ticker}")

        avg_fill_price = sum((f["qty"]*f["fill_price"] for f in fills_here), D(0)) / qty

        if action == "buy":
            row = hidx.get(ticker)
            if row:
                if any(f["currency"] != row["currency"] for f in fills_here):
                    die(f"currency mismatch for {ticker}")
                new_sh = row["shares"] + qty
                new_cost = ((row["shares"] * row["avg_cost"]) + (qty * avg_fill_price)) / new_sh
                row["shares"]   = round_shares(new_sh)
                row["avg_cost"] = round_price(new_cost)
            else:
                currency = fills_here[0]["currency"]
                hidx[ticker] = {
                    "ticker": ticker,
                    "shares": round_shares(qty),
                    "avg_cost": round_price(avg_fill_price),
                    "currency": currency
                }
        else:  # sell
            row = hidx.get(ticker)
            if not row:
                die(f"selling non-existent holding {ticker}")
            if qty > row["shares"]:
                die(f"sell qty {qty} exceeds holding {row['shares']} for {ticker}")
            new_sh = row["shares"] - qty
            row["shares"] = round_shares(new_sh)
            # avg_cost stays as original for remaining shares; remove row if zero
            if row["shares"] == 0:
                del hidx[ticker]

    # return as list in stable order
    return sorted(hidx.values(), key=lambda r: r["ticker"])

def apply_crypto(holdings, trades, fills):
    hidx = index_holdings(holdings, "symbol")
    fidx = {}
    for f in fills:
        k = (f["action"], f["symbol"])
        fidx.setdefault(k, []).append(f)

    for t in trades:
        action, symbol, amt = t["action"], t["symbol"], D(t["qty"])  # qty is "amount"
        fills_here = fidx.get((action, symbol), [])
        if not fills_here:
            die(f"no fill provided for trade {action} {symbol}")

        total_amt = sum((f["amount"] for f in fills_here), D(0))
        if total_amt != amt:
            die(f"fills amount {total_amt} != trade qty {amt} for {symbol}")

        avg_fill_price = sum((f["amount"]*f["fill_price_cad"] for f in fills_here), D(0)) / amt

        if action == "buy":
            row = hidx.get(symbol)
            if row:
                new_amt = row["amount"] + amt
                new_cost = ((row["amount"] * row["avg_cost_cad"]) + (amt * avg_fill_price)) / new_amt
                row["amount"]       = round_shares(new_amt)
                row["avg_cost_cad"] = round_price(new_cost)
            else:
                hidx[symbol] = {
                    "symbol": symbol,
                    "amount": round_shares(amt),
                    "avg_cost_cad": round_price(avg_fill_price)
                }
        else:  # sell
            row = hidx.get(symbol)
            if not row:
                die(f"selling non-existent holding {symbol}")
            if amt > row["amount"]:
                die(f"sell amount {amt} exceeds holding {row['amount']} for {symbol}")
            new_amt = row["amount"] - amt
            row["amount"] = round_shares(new_amt)
            if row["amount"] == 0:
                del hidx[symbol]

    return sorted(hidx.values(), key=lambda r: r["symbol"])

def write_holdings(rows, out_path, asset):
    # backup existing file if overwriting
    if Path(out_path).exists():
        ts = time.strftime("%Y%m%d-%H%M%S")
        backup = f"{out_path}.bak-{ts}"
        Path(out_path).replace(backup)
        print(f"Backed up previous holdings to {backup}")

    if asset == "equity":
        fieldnames = ["ticker","shares","avg_cost","currency"]
    else:
        fieldnames = ["symbol","amount","avg_cost_cad"]

    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow({k: str(v) for k,v in row.items()})

def main():
    ap = argparse.ArgumentParser(description="Apply executed trades to holdings (equity/crypto)")
    ap.add_argument("--asset", required=True, choices=["equity","crypto"])
    ap.add_argument("--holdings", required=True)
    ap.add_argument("--trades", required=True)
    ap.add_argument("--fills", required=True)
    ap.add_argument("--out", required=True, help="Output CSV (will overwrite; backup made)")
    args = ap.parse_args()

    trades = load_trades(args.trades, args.asset)
    fills  = load_fills(args.fills, args.asset)
    holdings = load_holdings(args.holdings, args.asset)

    if args.asset == "equity":
        updated = apply_equity(holdings, trades, fills)
    else:
        updated = apply_crypto(holdings, trades, fills)

    write_holdings(updated, args.out, args.asset)
    print(f"Wrote updated holdings → {args.out}")

if __name__ == "__main__":
    main()
