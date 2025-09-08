#!/usr/bin/env python3
# Weekly crypto snapshot → top 40 movers (20 up + 20 down), LLM-ready JSON
# Upgrades:
#  - Reads your holdings CSV and fetches live prices for each holding (market_price_cad)
#  - Auto-appends holdings as candidates (bucket="holding") so LLM can consider sells/rebalances
#  - Optional symbol→CoinGecko ID mapping via --symbol-map to avoid symbol mismatches
#  - **Baked-in 2% fee (FEE_RATE = 0.02) with effective buy/sell prices in JSON**
#
# Outputs:
#  - crypto_candidates_raw.csv
#  - crypto_shortlist_top40.csv
#  - llm_candidates_crypto.json
#
# Usage examples:
#   python3 screener_crypto_top40_fractional.py --cash 10 --fractional --min-trade-size 1 \
#     --supported-file ws_crypto_supported.json --holdings crypto_holdings.csv --pages 3
#
# holdings CSV schema (decimals allowed):
#   symbol,amount,avg_cost_cad
#   BTC,0.0025,87000
#   ETH,0.05,4200
#
# Dependencies: requests, pandas

import argparse, datetime as dt, json, time
from typing import List, Dict, Any, Tuple
import pandas as pd, requests

CG_BASE = "https://api.coingecko.com/api/v3"
HEADERS = {"User-Agent": "tfsa-llm/crypto-screener"}

# ---- BAKED-IN FEE ----
FEE_RATE = 0.02  # 2% Wealthsimple Crypto spread

DEFAULT_WS_SUPPORTED = [
  "ZRX","1INCH","AAVE","ALGO","ANKR","APE","API3","ARB","AVAX","AXS",
  "BNT","BAND","BAT","BNB","BTC","BCH","BLUR","BONK","ADA","CTSI","TIA",
  "CELO","LINK","CHZ","CHR","COMP","ATOM","COTI","CRV","MANA","DOGE","WIF",
  "DYDX","EIGEN","ENA","ETH","ETC","ENS","ETHFI","FARTCOIN","FET","FIL",
  "FLOKI","GALA","GOAT","GRASS","HBAR","HNT","IMX","INJ","JASMY","JTO",
  "JUP","CHILLGUY","KNC","LDO","LTC","LPT","LRC","MKR","SYRUP","MASK",
  "MOG","MOODENG","MORPHO","ALICE","NEAR","TRUMP","ONDO","OP","CAKE",
  "PNUT","PENDLE","PEPE","DOT","POL","POPCAT","PENGU","PUMP","PYTH","QNT",
  "RAY","RENDER","SEI","SHIB","SKL","SOL","S","SPX","XLM","STORJ","SUI",
  "SUPER","SUSHI","SNX","XTZ","GRT","TON","SAND","RUNE","TURBO","UMA",
  "UNI","USDC","VIRTUAL","WLFI","WLD","W","XRP","YFI","YGG"
]

# ------ HTTP helpers
def cg_get(path: str, params: Dict[str, Any] | None = None, retries: int = 3, backoff: float = 1.2):
    url = f"{CG_BASE}/{path.lstrip('/')}"
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, params=params or {}, timeout=20)
            if r.status_code == 200:
                return r.json()
            last = RuntimeError(f"HTTP {r.status_code}: {r.text[:160]}")
        except Exception as e:
            last = e
        time.sleep(backoff * (2 ** i))
    raise last if last else RuntimeError("coingecko request failed")

# ------ config loaders
def load_supported_symbols(path: str | None) -> set[str]:
    if path:
        try:
            data = json.loads(open(path, "r").read())
            syms = {str(s).upper().strip() for s in data if str(s).strip()}
            if syms:
                return syms
        except Exception as e:
            print(f"WARNING: failed to read --supported-file ({e}); falling back to default list.")
    return set(DEFAULT_WS_SUPPORTED)

def load_symbol_map(path: str | None) -> dict:
    """
    Optional mapping to resolve symbol -> CoinGecko id, e.g. {"RENDER":"render-token","POL":"polygon-ecosystem-token"}.
    Used primarily for holdings price lookups when symbol is ambiguous/missing in markets page(s).
    """
    if not path: return {}
    try:
        m = json.loads(open(path, "r").read())
        return {str(k).upper(): str(v) for k,v in m.items()}
    except Exception as e:
        print(f"WARNING: failed to read --symbol-map ({e}); ignoring.")
        return {}

# ------ data fetch
def fetch_markets_cad(per_page: int = 250, pages: int = 1) -> pd.DataFrame:
    rows = []
    for p in range(1, pages + 1):
        payload = cg_get("coins/markets", {
            "vs_currency":"cad",
            "order":"market_cap_desc",
            "per_page": per_page,
            "page": p,
            "price_change_percentage": "7d"
        })
        rows.extend(payload)
        time.sleep(0.6)  # be nice to API
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    keep = ["id","symbol","name","current_price","market_cap","total_volume","price_change_percentage_7d_in_currency"]
    df = df[keep].rename(columns={
        "current_price":"price_cad",
        "total_volume":"vol_24h",
        "price_change_percentage_7d_in_currency":"pct_change_1w"
    })
    df["symbol"] = df["symbol"].str.upper()
    # de-dup by symbol preferring highest market cap
    df = df.sort_values("market_cap", ascending=False).drop_duplicates(subset=["symbol"], keep="first")
    return df

def read_holdings_csv(path: str) -> list[dict]:
    out = []
    h = pd.read_csv(path)
    cols = {c.lower(): c for c in h.columns}
    req = ["symbol","amount","avg_cost_cad"]
    if not all(k in (x.lower() for x in h.columns) for k in req):
        print("WARNING: holdings file missing required columns (symbol,amount,avg_cost_cad). Ignoring holdings.")
        return out
    for _, r in h.iterrows():
        out.append({
            "symbol": str(r[cols["symbol"]]).upper().strip(),
            "amount": float(r[cols["amount"]]),
            "avg_cost_cad": float(r[cols["avg_cost_cad"]])
        })
    return out

# ------ holdings price enrichment
def build_symbol_to_id(df_markets: pd.DataFrame) -> dict:
    # Map symbol->id from markets df
    return {row["symbol"]: row["id"] for _, row in df_markets.iterrows()}

def lookup_ids_for_symbols(symbols: list[str], sym2id: dict, sym_map: dict) -> dict:
    """Return symbol->id, using markets map, then symbol-map, finally /coins/list fuzzy match."""
    out: dict[str,str] = {}
    missing = []
    for s in symbols:
        if s in sym2id:
            out[s] = sym2id[s]
        elif s in sym_map:
            out[s] = sym_map[s]
        else:
            missing.append(s)
    if missing:
        try:
            lst = cg_get("coins/list")  # id, symbol, name
            # prefer exact symbol match; if multiple, first is fine
            sym_groups: dict[str, list[str]] = {}
            for item in lst:
                sym = str(item.get("symbol","")).upper()
                cid = str(item.get("id",""))
                if not sym or not cid: continue
                sym_groups.setdefault(sym, []).append(cid)
            for s in missing:
                cands = sym_groups.get(s, [])
                if cands:
                    out[s] = cands[0]
        except Exception as e:
            print("WARNING: failed to fetch coins/list for fallback symbol resolution:", e)
    return out

def fetch_simple_prices_cad(ids: list[str]) -> dict:
    if not ids: return {}
    # CoinGecko 'simple/price' supports up to ~250 ids per request
    CHUNK = 200
    prices: dict[str, float] = {}
    for i in range(0, len(ids), CHUNK):
        sub = ids[i:i+CHUNK]
        resp = cg_get("simple/price", {"ids": ",".join(sub), "vs_currencies": "cad"})
        for cid, obj in resp.items():
            if "cad" in obj:
                prices[cid] = float(obj["cad"])
        time.sleep(0.6)
    return prices

# ------ main
def main():
    ap = argparse.ArgumentParser(description="Weekly crypto top40 (CoinGecko) → LLM JSON (with holdings prices, fee baked-in)")
    ap.add_argument("--cash", type=float, default=0.0, help="Cash available in CAD")
    ap.add_argument("--holdings", type=str, default=None, help="Path to crypto holdings CSV (symbol,amount,avg_cost_cad)")
    ap.add_argument("--supported-file", type=str, default=None, help="JSON array of Wealthsimple-supported symbols")
    ap.add_argument("--symbol-map", type=str, default=None, help="JSON mapping SYMBOL->coingecko_id for tricky cases")
    ap.add_argument("--up-count", type=int, default=20)
    ap.add_argument("--down-count", type=int, default=20)
    ap.add_argument("--min-price", type=float, default=0.05)
    ap.add_argument("--min-volume", type=float, default=50_000)
    ap.add_argument("--max-positions", type=int, default=10)
    ap.add_argument("--max-weight", type=float, default=0.20)
    ap.add_argument("--min-trade-size", type=float, default=1.0, help="Min CAD per trade")
    ap.add_argument("--fractional", action="store_true", help="Allow fractional quantities")
    ap.add_argument("--pages", type=int, default=1, help="How many pages of top market cap coins to pull (250 per page)")
    args = ap.parse_args()

    supported = load_supported_symbols(args.supported_file)
    sym_map = load_symbol_map(args.symbol_map)

    # 1) Markets snapshot
    df = fetch_markets_cad(per_page=250, pages=args.pages)
    if df.empty:
        raise SystemExit("No market data from CoinGecko; aborting.")

    # subset to Wealthsimple-supported, basic hygiene
    df = df[df["symbol"].isin(supported)].copy()
    df = df[(df["price_cad"] >= args.min_price) & (df["vol_24h"] >= args.min_volume)].copy()

    # Save raw candidates for transparency
    df.sort_values("pct_change_1w", ascending=False).to_csv("crypto_candidates_raw.csv", index=False)
    print(f"Wrote crypto_candidates_raw.csv with {len(df)} rows")

    # 2) Build top40 (up & down), each bucket volume-sorted
    upN = df.sort_values("pct_change_1w", ascending=False).head(args.up_count).copy()
    upN["bucket"] = "up"
    upN = upN.sort_values("vol_24h", ascending=False)

    downN = df.sort_values("pct_change_1w", ascending=True).head(args.down_count).copy()
    downN["bucket"] = "down"
    downN = downN.sort_values("vol_24h", ascending=False)

    short = pd.concat([upN, downN]).drop_duplicates(subset=["symbol"]).reset_index(drop=True)

    # 3) Read holdings and fetch holdings prices
    holdings_list = []
    if args.holdings:
        try:
            holdings_list = read_holdings_csv(args.holdings)
        except Exception as e:
            print("WARNING: failed to read holdings CSV:", e)
            holdings_list = []

    # map symbols to CG ids (first via markets, then map, then /coins/list)
    sym2id_market = build_symbol_to_id(df)  # from filtered df only
    # Expand mapping using the full markets universe (not only filtered) for better coverage:
    df_full = fetch_markets_cad(per_page=250, pages=max(1, args.pages))
    sym2id_full = build_symbol_to_id(df_full)
    sym2id = {**sym2id_full, **sym2id_market}  # prefer full first, then filtered (either is fine)

    holding_symbols = [h["symbol"] for h in holdings_list]
    symbol_to_id = lookup_ids_for_symbols(holding_symbols, sym2id, sym_map)
    hold_ids = [cid for s,cid in symbol_to_id.items() if s in holding_symbols]

    price_by_id = fetch_simple_prices_cad(hold_ids) if hold_ids else {}
    price_by_symbol = {s: price_by_id.get(symbol_to_id.get(s,""), None) for s in holding_symbols}

    # enrich holdings with market_price_cad
    for h in holdings_list:
        h["market_price_cad"] = price_by_symbol.get(h["symbol"], None)

    # 4) Append holdings as candidates (bucket="holding"), with prices
    #    If a holding symbol already in short, keep the better (the short already has price/volume).
    short_syms = set(short["symbol"].tolist())
    rows_hold = []
    for h in holdings_list:
        sym = h["symbol"]
        if sym in short_syms:
            continue
        price = h.get("market_price_cad", None)
        rows_hold.append({
            "id": symbol_to_id.get(sym, None) or "",
            "symbol": sym,
            "name": sym,  # name unknown here; fine
            "price_cad": float(price) if price is not None else None,
            "pct_change_1w": None,
            "vol_24h": 0.0,
            "bucket": "holding"
        })

    if rows_hold:
        short = pd.concat([short, pd.DataFrame(rows_hold)], ignore_index=True)

    short.to_csv("crypto_shortlist_top40.csv", index=False)
    print(f"Wrote crypto_shortlist_top40.csv with {len(short)} symbols (including holdings)")

    # 5) Build LLM payload
    payload = {
        "as_of": dt.date.today().isoformat(),
        "exchange": "Wealthsimple Crypto (non-registered)",
        "cash_available_cad": float(args.cash),
        "constraints": {
            "max_positions": int(args.max_positions),
            "max_weight_per_position": float(args.max_weight),
            "min_trade_size_cad": float(args.min_trade_size)
        },
        "fractional_allowed": bool(args.fractional),
        "order_mode": "market_only",
        "fee_rate": FEE_RATE,  # baked-in
        "holdings": holdings_list,  # includes market_price_cad now
        "candidates": [
            {
                "id": (r["id"] if pd.notnull(r["id"]) else ""),
                "symbol": r["symbol"],
                "name": r["name"] if "name" in r and pd.notnull(r["name"]) else r["symbol"],
                "price_cad": (float(r["price_cad"]) if pd.notnull(r["price_cad"]) else None),
                "pct_change_1w": (float(r["pct_change_1w"]) if pd.notnull(r["pct_change_1w"]) else None),
                "vol_24h": (float(r["vol_24h"]) if pd.notnull(r["vol_24h"]) else None),
                "bucket": r["bucket"]
            }
            for _, r in short.iterrows()
        ]
    }

    # Add effective buy/sell prices (fee-aware) to candidates and to holdings (if priced)
    for c in payload["candidates"]:
        p = c.get("price_cad")
        c["effective_buy_price_cad"]  = (None if p is None else round(p * (1.0 + FEE_RATE), 6))
        c["effective_sell_price_cad"] = (None if p is None else round(p * (1.0 - FEE_RATE), 6))

    for h in payload["holdings"]:
        mp = h.get("market_price_cad")
        h["effective_buy_price_cad"]  = (None if mp is None else round(mp * (1.0 + FEE_RATE), 6))
        h["effective_sell_price_cad"] = (None if mp is None else round(mp * (1.0 - FEE_RATE), 6))

    with open("llm_candidates_crypto.json", "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote llm_candidates_crypto.json with {len(payload['candidates'])} candidates")

if __name__ == "__main__":
    main()
