#!/usr/bin/env python3
# Step 1.5: Robust snapshot + LLM-ready shortlist
# - Normalizes Yahoo symbols for US class shares and TSX "-UN", "-A/-B"
# - Outputs:
#    - candidates_raw.csv (all)
#    - llm_candidates.json (shortlist: top 20 up + top 20 down, liquid, >$5)
#
# Run: python3 screener_step1_5.py

import datetime as dt
import io
import json
import re
import time
from typing import List

import pandas as pd
import requests
import yfinance as yf

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"}

# ----- fetch helpers -----
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
    syms = df[symcol].astype(str).str.strip().tolist()
    return syms

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
    # detect column by content (robust to header changes)
    ticker_re = re.compile(r"^[A-Z][A-Z0-9.\-]{0,6}$")
    best = None
    for tbl in tables:
        for col in tbl.columns:
            series = tbl[col].astype(str).str.strip()
            vals = series.dropna()
            if len(vals) == 0:
                continue
            matches = vals[vals.str.match(ticker_re)]
            if len(matches) >= 15 and len(matches) / max(1, len(vals)) > 0.5:
                best = matches.unique().tolist()
                break
        if best:
            break
    if not best:
        # fallback literal header names if heuristic missed
        for tbl in tables:
            for name in tbl.columns:
                if str(name).strip().lower() in ("symbol", "ticker", "ticker symbol"):
                    best = tbl[name].astype(str).str.strip().unique().tolist()
                    break
            if best:
                break
    if not best:
        raise RuntimeError("Couldn't find a plausible Symbol/Ticker column for TSX-60")
    # add .TO (we’ll normalize to Yahoo format later)
    syms = [s if s.endswith(".TO") else f"{s}.TO" for s in best]
    return syms

# ----- symbol normalization for Yahoo -----
MANUAL_FIXES = {
    # US class shares (dot → dash)
    "BRK.B": "BRK-B",
    "BRK.A": "BRK-A",
    "BF.B": "BF-B",
    "BF.A": "BF-A",
    # Common TSX offenders (dot class/unit → dash)
    "BIP.UN.TO": "BIP-UN.TO",
    "CAR.UN.TO": "CAR-UN.TO",
    "GIB.A.TO": "GIB-A.TO",
    "TECK.B.TO": "TECK-B.TO",
    "CTC.A.TO": "CTC-A.TO",
    "RCI.B.TO": "RCI-B.TO",
    "CCL.B.TO": "CCL-B.TO",
}

def normalize_symbol(sym: str) -> str:
    # manual overrides first
    if sym in MANUAL_FIXES:
        return MANUAL_FIXES[sym]
    # US: convert class dot to dash (e.g., ABC.B → ABC-B) when not a TSX ticker
    if not sym.endswith(".TO") and "." in sym:
        parts = sym.split(".")
        if len(parts) == 2 and len(parts[1]) <= 3:
            return f"{parts[0]}-{parts[1]}"
    # TSX: convert .UN/.A/.B/.U etc. to dash form
    if sym.endswith(".TO"):
        # pattern: NAME.<CLASS>.TO → NAME-<CLASS>.TO
        m = re.match(r"^([A-Z0-9]+)\.([A-Z]{1,3})\.TO$", sym)
        if m:
            base, cls = m.groups()
            return f"{base}-{cls}.TO"
    return sym

# ----- calc helpers -----
def pct_1w(series: pd.Series) -> float:
    if len(series) < 6:
        return float("nan")
    return (series.iloc[-1] / series.iloc[-6] - 1) * 100.0

def main():
    sp500 = get_sp500()
    tsx60 = get_tsx60()

    # normalize to Yahoo symbols up front
    universe = sorted({normalize_symbol(s) for s in (sp500 + tsx60)})

    end = dt.date.today()
    start = end - dt.timedelta(days=14)  # ~10 trading days

    print(f"Downloading history for {len(universe)} tickers…")
    hist = yf.download(
        universe, start=start, end=end,
        interval="1d", group_by="ticker",
        auto_adjust=True, threads=True
    )

    rows = []
    failed = []
    for t in universe:
        try:
            df = hist[t].dropna()
            if len(df) < 6:
                failed.append((t, "too_short"))
                continue
            close_today = float(df["Close"].iloc[-1])
            change = pct_1w(df["Close"])
            avg_vol_5 = float(df["Volume"].tail(5).mean())
            rows.append({
                "ticker": t,
                "close": round(close_today, 2),
                "pct_change_1w": round(change, 2),
                "avg_volume_5d": int(avg_vol_5),
            })
        except Exception as e:
            failed.append((t, str(e)))

    df_all = pd.DataFrame(rows).sort_values("pct_change_1w", ascending=False)
    df_all.to_csv("candidates_raw.csv", index=False)
    print(f"Wrote candidates_raw.csv with {len(df_all)} tickers")
    if failed:
        print("Failed/Skipped:", len(failed))
        # also write a log to inspect
        pd.DataFrame(failed, columns=["ticker","reason"]).to_csv("failed_tickers.csv", index=False)

    # ------- Shortlist for LLM -------
    # Liquidity/price filters (tweak if you want stricter)
    def is_cad(sym: str) -> bool: return sym.endswith(".TO")
    liq_thresh = df_all["avg_volume_5d"].quantile(0.25) if not df_all.empty else 0  # keep top 75% by vol by default
    df_filt = df_all[
        (df_all["close"] >= 5.0) &
        (df_all["avg_volume_5d"] >= max(100000, liq_thresh))  # at least 100k shares or top vol quartile
    ].copy()

    # top 20 up and top 20 down from filtered set
    up20 = df_filt.sort_values("pct_change_1w", ascending=False).head(20)
    down20 = df_filt.sort_values("pct_change_1w", ascending=True).head(20)
    short = pd.concat([up20, down20]).drop_duplicates(subset=["ticker"]).reset_index(drop=True)

    payload = {
        "as_of": end.isoformat(),
        "cash_available_cad": 0.0,  # you fill this at prompt time
        "holdings": [],             # you fill holdings weekly
        "candidates": [
            {
                "ticker": r["ticker"],
                "price": r["close"],
                "pct_change_1w": r["pct_change_1w"],
                "avg_volume_5d": int(r["avg_volume_5d"]),
                "listing": "CAD" if is_cad(r["ticker"]) else "USD"
            }
            for _, r in short.iterrows()
        ]
    }

    with open("llm_candidates.json", "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote llm_candidates.json with {len(payload['candidates'])} candidates")

if __name__ == "__main__":
    main()
