
---

# Methodology

## What this site shows

I’m contributing to a TFSA every week with a **linear ramp** (week 1 = \$10, then +\$1 per week). I run a simple weekly process to shortlist candidates, ask an LLM for a plan, place trades on Wealthsimple, and record **executed fills only**. This page documents that process so anyone can reproduce it.

## Data sources (local JSON/CSV)

* `data/entries.json` — weekly deposits and executed trades (for the public timeline)
* `holdings.csv` — stocks/ETFs (ticker, shares, avg\_cost, currency)
* `crypto_holdings.csv` — crypto (symbol, amount, avg\_cost\_cad)
* `benchmarks.json` — S\&P 500 closes & HISA rate for comparison

## Weekly process (high level)

1. **Generate candidates**

   * Stocks: TSX-60 + S\&P 500 universe → compute 1-week movers → take **top 20 up + top 20 down** (volume-screened).
   * Crypto: CoinGecko markets (CAD), Wealthsimple-supported only → **top 20 up + top 20 down** (volume-screened).
   * **Holdings are always appended** to the candidate list so the LLM can rebalance/trim even if something isn’t a weekly mover.
   * **Crypto fee baked in:** all buy/sell math uses `FEE_RATE = 2%` spread via effective prices.

2. **Ask the LLM for trades**

   * I paste the generated JSON.
   * The model must respect cash, max positions/weights, min trade size, and it’s allowed to **hold cash** or have **sell-only** weeks.
   * For stocks it may propose **limit** orders; for crypto I use market only.

3. **Execute on Wealthsimple**

   * If a ticker/coin isn’t available or fractional is blocked, I skip it (or choose the CAD equivalent) and re-ask.

4. **Record fills (source of truth)**

   * I use a small TUI to enter **executed** trades (either per-unit price or **TOTAL CAD incl. fees**).
   * It updates `holdings*.csv` (weighted average cost) and appends a weekly row to `data/*entries.json`.

5. **Publish**

   * The site renders portfolio value, contributions, and benchmarks from these files.

<details>
<summary>Scripts & commands</summary>

**Stocks**

```bash
python3 screener_top40_fractional.py --cash <stocks_cash> --fractional --min-trade-size 1 --holdings holdings.csv
```

**Crypto** (2% fee baked in)

```bash
python3 screener_crypto_top40_fractional.py --cash <crypto_cash> --fractional --min-trade-size 1 --holdings crypto_holdings.csv --pages 3
```

**Log executed trades (updates holdings + entries)**

```bash
python3 ledger_tui.py
```

</details>

<details>
<summary>LLM prompts used each week</summary>

**Stocks (TFSA)**

```
You are a portfolio rebalancer for a Canadian TFSA. Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "ticker":"", "qty":0, "limit_price": null }],
  "rationale": "",
  "risk_notes": ""
}
Rules:
- Long-only stocks/ETFs. Respect cash, max_positions, max_weight_per_position, min_trade_size_cad.
- Prefer CAD listings when materially similar to USD.
- It is acceptable to hold cash. Sell-only weeks are allowed. Do not auto-reinvest sale proceeds.
- ≤ 3 trades this week. Minimize churn.
- Use limit_price for planned limits (GTC). If it doesn’t fill, nothing is recorded.
- Only tickers present in "candidates" (holdings already appended).
- If no changes: {"trades":[],"rationale":"No change","risk_notes":""}. No commentary outside JSON.
```

**Crypto (Wealthsimple Crypto)**

```
You are a crypto allocator. Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "symbol":"", "qty":0, "limit_price": null }],
  "rationale": "",
  "risk_notes": ""
}
Rules:
- Long-only spot. Use "fractional_allowed" and "min_trade_size_cad".
- Fees baked in: buys use effective_buy_price_cad; sells use effective_sell_price_cad.
- Σ(buy_qty*effective_buy) − Σ(sell_qty*effective_sell) ≤ cash_available_cad.
- It is acceptable to hold cash. Sell-only weeks allowed.
- ≤ 2 coins this week to reduce 2% fee drag. Market only (limit_price = null).
- Only symbols present in "candidates". If no changes: {"trades":[],"rationale":"No change","risk_notes":""}. No commentary outside JSON.
```

</details>

## Linear contribution schedule

Starting deposit **a = \$10**, weekly increment **d = \$1**, week index $t = 1,2,\dots$.

* **This week’s deposit**

  $$
  c_t = a + (t-1)\,d = 10 + (t-1)\cdot 1 = t+9
  $$

  Example: week 52 deposit $c_{52}=61$.

* **Total contributed after $N$ weeks** (arithmetic series)

  $$
  S_N = \frac{N}{2}\big(2a + (N-1)d\big) = \frac{N}{2}(N+19)
  $$

  Example: $S_{52} = 1846$.

<details>
<summary>Utility (TypeScript)</summary>

```ts
export const weeklyContribution = (t: number, a = 10, d = 1) =>
  a + (t - 1) * d;

export const totalContributed = (N: number, a = 10, d = 1) =>
  (N / 2) * (2 * a + (N - 1) * d);
```

</details>

## Benchmarks

* **HISA (3% APY, daily comp)**
  Daily rate $r_d = (1+0.03)^{1/365}-1$.
  Each weekly deposit compounds daily from its date: $V = \sum_i \text{deposit}_i \cdot (1+r_d)^{\text{days\_since}_i}$.

* **S\&P 500 DCA**
  Each week’s deposit buys index units at that week’s close; units are valued at the latest close.

## Limitations

* Prices are end-of-day snapshots; intraday fills may differ.
* CAD/USD mixing is simplified (CAD-listed preferred; crypto priced in CAD).
* Dividends/distributions are not modeled yet.
* No background automation; **only filled orders** are recorded.

## Reproducibility

All calculations live in `/lib/math.ts` and scripts in this repo. Anyone can replicate outcomes by:

1. running the screeners,
2. placing the same trades,
3. logging fills via the TUI,
4. rebuilding the site from the same JSON/CSV.
