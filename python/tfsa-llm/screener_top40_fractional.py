#!/usr/bin/env python3
# Weekly TSX60 + S&P500 snapshot → top 40 movers (20 up + 20 down), LLM-ready JSON
# Upgrades:
#  - Reads your holdings.csv and fetches live prices for each holding (market_price)
#  - Auto-appends ALL holdings as candidates (bucket="holding") so LLM can consider sells/rebalances
#  - Same flags/UX as before; fractional-mode supported
#
# Outputs:
#  - candidates_raw.csv        (full universe)
#  - shortlist_top40.csv       (20 up + 20 down, liquid, price>=$min_price; + holdings)
#  - llm_candidates.json       (ready to paste into LLM)
#
# holdings.csv schema:
#   ticker,shares,avg_cost,currency
#   XIU.TO,1.3,33.1115,CAD
#   AAPL,0.2,190.00,USD
#
# Usage examples:
#   python3 screener_top40_fractional.py --cash 10 --fractional --min-trade-size 1 --holdings holdings.csv
#   python3 screener_top40_fractional.py --cash 500 --holdings holdings.csv
#
# Dependencies: yfinance pandas requests lxml html5lib beautifulsoup4

import argparse, datetime as dt, io, json, re, time
from typing import List, Dict, Any
import pandas as pd, requests, yfinance as yf

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"}

# ---------- helpers to fetch HTML (Wikipedia)
def fetch_html(url: str, max_retries: int = 3, backoff: float = 1.0) -> str:
    last_err = None
    for i in range(max_retries):
        try:
            r = requests.get(url, headers=UA, timeout=20)
            if r.status_code == 200:
                return r.text
            last_err = RuntimeError(f"HTTP {r.status_code}")
        except Exception as e:
            last_err = e
        time.sleep(backoff * (2 ** i))
    raise last_err if last_err else RuntimeError("Unknown fetch error")

def get_sp500_from_wikipedia() -> List[str]:
    html = fetch_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
    tables = pd.read_html(io.StringIO(html))
    df = tables[0]
    symcol = "Symbol" if "Symbol" in df.columns else [c for c in df.columns if "symbol" in str(c).lower()][0]
    return df[symcol].astype(str).str.strip().tolist()

def get_sp500() -> List[str]:
    try:
        return get_sp500_from_wikipedia()
    except Exception as e:
        print("S&P 500 Wikipedia scrape failed, falling back:", e)
        try:
            return yf.tickers_sp500()
        except Exception as e2:
            raise RuntimeError(f"Could not retrieve S&P 500 tickers: {e2}")

def get_tsx60() -> List[str]:
    html = fetch_html("https://en.wikipedia.org/wiki/S%26P/TSX_60")
    tables = pd.read_html(io.StringIO(html))
    if not tables:
        raise RuntimeError("No tables on TSX-60 page")
    ticker_re = re.compile(r"^[A-Z][A-Z0-9.\-]{0,6}$")
    best = None
    for tbl in tables:
        for col in tbl.columns:
            series = tbl[col].astype(str).str.strip()
            vals = series.dropna()
            if len(vals) == 0: continue
            matches = vals[vals.str.match(ticker_re)]
            if len(matches) >= 15 and len(matches) / max(1, len(vals)) > 0.5:
                best = matches.unique().tolist()
                break
        if best: break
    if not best:
        for tbl in tables:
            for name in tbl.columns:
                if str(name).strip().lower() in ("symbol", "ticker", "ticker symbol"):
                    best = tbl[name].astype(str).str.strip().unique().tolist(); break
            if best: break
    if not best:
        raise RuntimeError("Couldn't find a plausible Symbol/Ticker column for TSX-60")
    return [s if s.endswith(".TO") else f"{s}.TO" for s in best]

# ---------- normalize YF symbols (class shares)
MANUAL_FIXES = {
    "BRK.B":"BRK-B","BRK.A":"BRK-A","BF.B":"BF-B","BF.A":"BF-A",
    "BIP.UN.TO":"BIP-UN.TO","CAR.UN.TO":"CAR-UN.TO","GIB.A.TO":"GIB-A.TO",
    "TECK.B.TO":"TECK-B.TO","CTC.A.TO":"CTC-A.TO","RCI.B.TO":"RCI-B.TO","CCL.B.TO":"CCL-B.TO",
}
def normalize_symbol(sym: str) -> str:
    s = sym.strip().upper()
    if s in MANUAL_FIXES: return MANUAL_FIXES[s]
    if not s.endswith(".TO") and "." in s:
        parts = s.split(".")
        if len(parts)==2 and len(parts[1])<=3: return f"{parts[0]}-{parts[1]}"
    if s.endswith(".TO"):
        m = re.match(r"^([A-Z0-9]+)\.([A-Z]{1,3})\.TO$", s)
        if m: return f"{m.group(1)}-{m.group(2)}.TO"
    return s

def denormalize_to_display(sym: str) -> str:
    # Keep candidates in normalized YF form to match pricing; display is same.
    # (If you want dot-class for display, convert "-X.TO" -> ".X.TO" here.)
    return sym

def pct_1w(series: pd.Series) -> float:
    if len(series) < 6: return float("nan")
    return (series.iloc[-1] / series.iloc[-6] - 1) * 100.0

def is_cad(sym: str) -> bool: return sym.endswith(".TO")

# ---------- holdings read
def read_holdings_csv(path: str) -> list[dict]:
    out = []
    h = pd.read_csv(path)
    cols = {c.lower(): c for c in h.columns}
    req = ["ticker","shares","avg_cost","currency"]
    if not all(r in (x.lower() for x in h.columns) for r in req):
        print("WARNING: holdings.csv missing required columns; ignoring.")
        return out
    for _, r in h.iterrows():
        out.append({
            "ticker": str(r[cols["ticker"]]).strip(),
            "shares": float(r[cols["shares"]]),
            "avg_cost": float(r[cols["avg_cost"]]),
            "currency": str(r[cols["currency"]]).strip().upper()
        })
    return out

# ---------- price lookup (fast path from batch hist, fallback per-ticker)
def last_close_from_hist(hist: pd.DataFrame, yf_ticker: str) -> float | None:
    try:
        df = hist[yf_ticker].dropna()
        if len(df) == 0: return None
        return float(df["Close"].iloc[-1])
    except Exception:
        return None

def last_close_single(yf_ticker: str) -> float | None:
    try:
        df = yf.Ticker(yf_ticker).history(period="5d", interval="1d", auto_adjust=True)
        if df is None or df.empty: return None
        return float(df["Close"].iloc[-1])
    except Exception:
        return None

def main():
    p = argparse.ArgumentParser(description="Weekly top40 with optional fractional mode (holdings-aware)")
    p.add_argument("--cash", type=float, default=0.0, help="Cash available in CAD")
    p.add_argument("--holdings", type=str, default=None, help="Path to holdings.csv (ticker,shares,avg_cost,currency)")
    p.add_argument("--up-count", type=int, default=20)
    p.add_argument("--down-count", type=int, default=20)
    p.add_argument("--min-price", type=float, default=5.0)
    p.add_argument("--min-volume", type=int, default=100_000)
    p.add_argument("--max-positions", type=int, default=10)
    p.add_argument("--max-weight", type=float, default=0.20)
    p.add_argument("--min-trade-size", type=float, default=100.0, help="Minimum CAD per trade")
    p.add_argument("--fractional", action="store_true", help="Allow fractional shares (set in JSON for LLM)")
    args = p.parse_args()

    # 1) Universe
    sp500, tsx60 = get_sp500(), get_tsx60()
    universe_norm = sorted({normalize_symbol(s) for s in (sp500 + tsx60)})

    end = dt.date.today(); start = end - dt.timedelta(days=14)

    print(f"Downloading history for {len(universe_norm)} tickers…")
    hist = yf.download(universe_norm, start=start, end=end, interval="1d", group_by="ticker", auto_adjust=True, threads=True)

    # 2) Build raw dataframe
    rows, failed = [], []
    for t in universe_norm:
        try:
            df = hist[t].dropna()
            if len(df) < 6: failed.append((t,"too_short")); continue
            close_today = float(df["Close"].iloc[-1])
            change = pct_1w(df["Close"])
            avg_vol_5 = float(df["Volume"].tail(5).mean())
            rows.append({
                "ticker": t,
                "close": round(close_today, 2),
                "pct_change_1w": round(change, 2),
                "avg_volume_5d": int(avg_vol_5),
                "listing": "CAD" if is_cad(t) else "USD",
            })
        except Exception as e:
            failed.append((t, str(e)))

    df_all = pd.DataFrame(rows).sort_values("pct_change_1w", ascending=False)
    df_all.to_csv("candidates_raw.csv", index=False)
    print(f"Wrote candidates_raw.csv with {len(df_all)} tickers")
    if failed:
        pd.DataFrame(failed, columns=["ticker","reason"]).to_csv("failed_tickers.csv", index=False)
        print(f"Logged {len(failed)} failed/short symbols → failed_tickers.csv")

    if df_all.empty: raise SystemExit("No data retrieved; aborting.")

    # 3) Liquidity filters + top40
    liq_thresh = df_all["avg_volume_5d"].quantile(0.25)
    df_filt = df_all[(df_all["close"] >= args.min_price) & (df_all["avg_volume_5d"] >= max(args.min_volume, liq_thresh))].copy()

    up = df_filt.sort_values("pct_change_1w", ascending=False).head(args.up_count)
    up = up.sort_values("avg_volume_5d", ascending=False).copy(); up["bucket"] = "up"
    down = df_filt.sort_values("pct_change_1w", ascending=True).head(args.down_count)
    down = down.sort_values("avg_volume_5d", ascending=False).copy(); down["bucket"] = "down"
    short = pd.concat([up, down]).drop_duplicates(subset=["ticker"]).reset_index(drop=True)

    # 4) Read holdings + enrich with live prices
    holdings_list = []
    if args.holdings:
        try:
            holdings_list = read_holdings_csv(args.holdings)
        except Exception as e:
            print("WARNING: failed to read holdings.csv:", e)
            holdings_list = []

    # Add market_price to holdings
    short_set_norm = set(short["ticker"])
    for h in holdings_list:
        raw = h["ticker"]
        yf_sym = normalize_symbol(raw)
        price = last_close_from_hist(hist, yf_sym)
        if price is None:
            price = last_close_single(yf_sym)
        h["market_price"] = round(float(price), 4) if price is not None else None
        h["ticker"] = denormalize_to_display(raw)  # keep user-facing symbol as-is

    # 5) Append holdings as candidates (bucket="holding") if not already present
    def to_norm(s: str) -> str: return normalize_symbol(s)
    candidate_norms = set(short["ticker"])
    rows_hold = []
    for h in holdings_list:
        norm_sym = to_norm(h["ticker"])
        if norm_sym in candidate_norms:
            continue
        rows_hold.append({
            "ticker": norm_sym,
            "close": h["market_price"] if h["market_price"] is not None else None,
            "pct_change_1w": None,
            "avg_volume_5d": None,
            "listing": "CAD" if is_cad(norm_sym) else "USD",
            "bucket": "holding"
        })

    if rows_hold:
        short = pd.concat([short, pd.DataFrame(rows_hold)], ignore_index=True)

    short.to_csv("shortlist_top40.csv", index=False)
    print(f"Wrote shortlist_top40.csv with {len(short)} tickers (including holdings)")

    # 6) Build JSON payload
    payload = {
        "as_of": end.isoformat(),
        "cash_available_cad": float(args.cash),
        "constraints": {
            "max_positions": int(args.max_positions),
            "max_weight_per_position": float(args.max_weight),
            "min_trade_size_cad": float(args.min_trade_size)
        },
        "fractional_allowed": bool(args.fractional),
        "order_mode": "market_only_if_fractional" if args.fractional else "market_or_limit",
        "holdings": holdings_list,  # now includes market_price
        "candidates": [
            {
                "ticker": r["ticker"],
                "price": (float(r["close"]) if pd.notnull(r["close"]) else None),
                "pct_change_1w": (float(r["pct_change_1w"]) if pd.notnull(r["pct_change_1w"]) else None),
                "avg_volume_5d": (int(r["avg_volume_5d"]) if pd.notnull(r["avg_volume_5d"]) else None),
                "listing": r["listing"],
                "bucket": r["bucket"]
            } for _, r in short.iterrows()
        ]
    }

    with open("llm_candidates.json", "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote llm_candidates.json with {len(payload['candidates'])} candidates")

if __name__ == "__main__":
    main()
