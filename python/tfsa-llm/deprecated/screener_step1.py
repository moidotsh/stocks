#!/usr/bin/env python3
# Robust Step 1: fetch S&P 500 + TSX 60, compute weekly change & volume snapshot
# - Avoids 403 by fetching HTML with headers
# - Falls back to yfinance's tickers_sp500() if Wikipedia fails
# - Outputs candidates_raw.csv

import datetime as dt
import time
import io
import pandas as pd
import yfinance as yf
import requests

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"}

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

def get_sp500_from_wikipedia() -> list[str]:
    html = fetch_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
    tables = pd.read_html(io.StringIO(html))
    # First table typically contains the constituents
    df = tables[0]
    if "Symbol" not in df.columns:
        # Sometimes the column name differs slightly
        symbol_col = [c for c in df.columns if "symbol" in str(c).lower()]
        if not symbol_col:
            raise RuntimeError("Couldn't find Symbol column for S&P 500")
        symcol = symbol_col[0]
    else:
        symcol = "Symbol"
    syms = df[symcol].astype(str).str.strip().tolist()
    # Normalize Berkshire tickers etc. (yfinance accepts current US symbols as-is)
    return syms

def get_sp500_fallback() -> list[str]:
    # yfinance helper exists on many versions
    try:
        return yf.tickers_sp500()
    except Exception:
        return []

def get_sp500() -> list[str]:
    try:
        syms = get_sp500_from_wikipedia()
        if syms:
            return syms
    except Exception as e:
        print("S&P 500 Wikipedia scrape failed, falling back:", e)
    syms = get_sp500_fallback()
    if not syms:
        raise RuntimeError("Could not retrieve S&P 500 tickers from any source")
    return syms

def get_tsx60() -> list[str]:
    """Return TSX-60 tickers, robust to Wikipedia table/column changes."""
    import re, io, pandas as pd, requests, time

    UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"}
    url = "https://en.wikipedia.org/wiki/S%26P/TSX_60"

    # fetch with headers + retry
    last_err = None
    for i in range(3):
        try:
            r = requests.get(url, headers=UA, timeout=20)
            r.raise_for_status()
            html = r.text
            break
        except Exception as e:
            last_err = e
            time.sleep(1.5 * (2 ** i))
    else:
        raise RuntimeError(f"TSX-60 fetch failed: {last_err}")

    tables = pd.read_html(io.StringIO(html))
    if not tables:
        raise RuntimeError("No tables found on TSX-60 page")

    # Heuristic: find a column whose values look like tickers (A–Z, . or -), mostly uppercase, short length
    ticker_re = re.compile(r"^[A-Z][A-Z0-9.\-]{0,6}$")
    best = None

    for tbl in tables:
        for col in tbl.columns:
            series = tbl[col].astype(str).str.strip()
            # filter plausible-looking values
            vals = series.dropna()
            if len(vals) == 0:
                continue
            matches = vals[vals.str.match(ticker_re)]
            # require at least ~15 plausible symbols and >50% of non-null rows matching
            if len(matches) >= 15 and len(matches) / max(1, len(vals)) > 0.5:
                best = matches.unique().tolist()
                break
        if best:
            break

    if not best:
        # Fallback: look for a column literally named "Symbol" or "Ticker" if heuristic missed
        for tbl in tables:
            for name in tbl.columns:
                if str(name).strip().lower() in ("symbol", "ticker", "ticker symbol"):
                    best = tbl[name].astype(str).str.strip().unique().tolist()
                    break
            if best:
                break

    if not best:
        raise RuntimeError("Couldn't find a plausible Symbol/Ticker column for TSX-60")

    # Normalize to Yahoo Finance TSX suffix
    syms = []
    for s in best:
        s = s.replace("-", "-").replace("—", "-")  # normalize unicode dashes
        s = s.split()[0]  # drop any footnote markers
        if not s.endswith(".TO"):
            s = f"{s}.TO"
        syms.append(s)

    # Deduplicate and sort
    return sorted(set(syms))

    # Wikipedia + .TO suffix
    html = fetch_html("https://en.wikipedia.org/wiki/S%26P/TSX_60")
    tables = pd.read_html(io.StringIO(html))
    df = tables[0]
    # Column may be "Symbol" or "Ticker" depending on revision
    candidates = [c for c in df.columns if str(c).lower() in ("symbol", "ticker")]
    if not candidates:
        raise RuntimeError("Couldn't find Symbol/Ticker column for TSX 60")
    symcol = candidates[0]
    syms = df[symcol].astype(str).str.strip().tolist()
    syms = [s if s.endswith(".TO") else f"{s}.TO" for s in syms]
    return syms

def pct_1w(series: pd.Series) -> float:
    if len(series) < 6:
        return float("nan")
    return (series.iloc[-1] / series.iloc[-6] - 1) * 100.0

def main():
    sp500 = get_sp500()
    tsx60 = get_tsx60()
    universe = sorted(set(sp500 + tsx60))

    end = dt.date.today()
    start = end - dt.timedelta(days=14)  # ~10 trading days

    print(f"Downloading history for {len(universe)} tickers…")
    hist = yf.download(
        universe, start=start, end=end,
        interval="1d", group_by="ticker",
        auto_adjust=True, threads=True
    )

    rows = []
    for t in universe:
        try:
            df = hist[t].dropna()
            if len(df) < 6:
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
            print("skip", t, e)

    out = pd.DataFrame(rows).sort_values("pct_change_1w", ascending=False)
    out.to_csv("candidates_raw.csv", index=False)
    print(f"Wrote candidates_raw.csv with {len(out)} tickers")

if __name__ == "__main__":
    main()

