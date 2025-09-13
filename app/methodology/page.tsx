'use client'

import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CopyButton } from "@/components/ui/copy-button"

export default function MethodologyPage() {
  const stockScreenerCommand = `python3 screener_top40_fractional.py --cash <stocks_cash> --fractional --min-trade-size 1 --holdings holdings.csv`
  
  const cryptoScreenerCommand = `python3 screener_crypto_top40_fractional.py --cash <crypto_cash> --fractional --min-trade-size 1 --holdings crypto_holdings.csv --pages 3`
  
  const ledgerCommand = `python3 ledger_tui.py`

  const stocksPrompt = `You are a portfolio rebalancer for a Canadian TFSA. Return ONLY valid JSON:
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
- Use limit_price for planned limits (GTC). If it doesn't fill, nothing is recorded.
- Only tickers present in "candidates" (holdings already appended).
- If no changes: {"trades":[],"rationale":"No change","risk_notes":""}. No commentary outside JSON.`

  const cryptoPrompt = `You are a crypto allocator. Return ONLY valid JSON:
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
- Only symbols present in "candidates". If no changes: {"trades":[],"rationale":"No change","risk_notes":""}. No commentary outside JSON.`

  const utilityCode = `export const weeklyContribution = (t: number, a = 10, d = 1) =>
  a + (t - 1) * d;

export const totalContributed = (N: number, a = 10, d = 1) =>
  (N / 2) * (2 * a + (N - 1) * d);`

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Methodology</h1>
        <p className="text-muted-foreground">
          Complete workflow for reproducible portfolio tracking
        </p>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">What this site shows</h2>
          <p>
            I'm contributing to a TFSA every week with a <strong>linear ramp</strong> (week 1 = $10, then +$1 per week). 
            I run a simple weekly process to shortlist candidates, ask an LLM for a plan, place trades on Wealthsimple, 
            and record <strong>executed fills only</strong>. This page documents that process so anyone can reproduce it.
          </p>
        </section>

        <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Data sources (local JSON/CSV)</h2>
          <ul className="space-y-2">
            <li><code className="bg-muted px-2 py-1 rounded text-sm">data/entries.json</code> — weekly deposits and executed trades (for the public timeline)</li>
            <li><code className="bg-muted px-2 py-1 rounded text-sm">holdings.csv</code> — stocks/ETFs (ticker, shares, avg_cost, currency)</li>
            <li><code className="bg-muted px-2 py-1 rounded text-sm">crypto_holdings.csv</code> — crypto (symbol, amount, avg_cost_cad)</li>
            <li><code className="bg-muted px-2 py-1 rounded text-sm">benchmarks.json</code> — S&P 500 closes & HISA rate for comparison</li>
            <li><code className="bg-muted px-2 py-1 rounded text-sm">data/candidates/latest.json</code> — pointer to current week's fresh candidates</li>
            <li><code className="bg-muted px-2 py-1 rounded text-sm">data/candidates/YYYY-MM-DD/</code> — dated folders with weekly screener output (stocks.json, crypto.json)</li>
          </ul>
        </section>

        <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Weekly process (high level)</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">1. Generate fresh candidates</h3>
              <ul className="space-y-2 text-sm">
                <li><strong>Run weekly screeners:</strong> Fresh top-40 movers change every week. Using stale candidates defeats the whole point.</li>
                <li><strong>Stocks:</strong> TSX-60 + S&P 500 universe → compute 1-week movers → take <strong>top 20 up + top 20 down</strong> (volume-screened).</li>
                <li><strong>Crypto:</strong> CoinGecko markets (CAD), Wealthsimple-supported only → <strong>top 20 up + top 20 down</strong> (volume-screened).</li>
                <li><strong>Holdings are always appended</strong> to the candidate list so the LLM can rebalance/trim even if something isn't a weekly mover.</li>
                <li><strong>Crypto fee baked in:</strong> all buy/sell math uses <code>FEE_RATE = 2%</code> spread via effective prices.</li>
                <li><strong>File structure:</strong> Candidates saved to <code>data/candidates/YYYY-MM-DD/</code> with <code>latest.json</code> pointer.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">2. Ask the LLM for trades</h3>
              <ul className="space-y-2 text-sm">
                <li>I paste the generated JSON.</li>
                <li>The model must respect cash, max positions/weights, min trade size, and it's allowed to <strong>hold cash</strong> or have <strong>sell-only</strong> weeks.</li>
                <li>For stocks it may propose <strong>limit</strong> orders; for crypto I use market only.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">3. Execute on Wealthsimple</h3>
              <p className="text-sm">
                If a ticker/coin isn't available or fractional is blocked, I skip it (or choose the CAD equivalent) and re-ask.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">4. Record fills (source of truth)</h3>
              <ul className="space-y-2 text-sm">
                <li>I use a small TUI to enter <strong>executed</strong> trades (either per-unit price or <strong>TOTAL CAD incl. fees</strong>).</li>
                <li>It updates <code>holdings*.csv</code> (weighted average cost) and appends a weekly row to <code>data/*entries.json</code>.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">5. Publish</h3>
              <p className="text-sm">
                The site renders portfolio value, contributions, and benchmarks from these files.
              </p>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="scripts">
              <AccordionTrigger>Scripts & commands</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">1. Run Screeners (Sunday before Close Week)</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Stocks</span>
                        <CopyButton text={stockScreenerCommand} />
                      </div>
                      <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                        <code>{stockScreenerCommand}</code>
                      </pre>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Crypto (2% fee baked in)</span>
                        <CopyButton text={cryptoScreenerCommand} />
                      </div>
                      <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                        <code>{cryptoScreenerCommand}</code>
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">2. Organize Files for Close Week</h4>
                      <CopyButton text={`DATE=$(date +%F)
mkdir -p data/candidates/$DATE
mv llm_candidates.json data/candidates/$DATE/stocks.json
mv llm_candidates_crypto.json data/candidates/$DATE/crypto.json
printf '{"{"}"latest":"%s"{"}"}{"\n"}' "$DATE" {">"}  data/candidates/latest.json`} />
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      <code>{`DATE=$(date +%F)
mkdir -p data/candidates/$DATE
mv llm_candidates.json data/candidates/$DATE/stocks.json
mv llm_candidates_crypto.json data/candidates/$DATE/crypto.json
printf '{"{"}"latest":"%s"{"}"}{"\n"}' "$DATE" {">"}  data/candidates/latest.json`}</code>
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      This creates dated folders and updates the latest pointer for Close Week to read fresh candidates.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">3. Log executed trades (updates holdings + entries)</h4>
                      <CopyButton text={ledgerCommand} />
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      <code>{ledgerCommand}</code>
                    </pre>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="prompts">
              <AccordionTrigger>LLM prompts used each week</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Stocks (TFSA)</h4>
                      <CopyButton text={stocksPrompt} />
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                      <code>{stocksPrompt}</code>
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Crypto (Wealthsimple Crypto)</h4>
                      <CopyButton text={cryptoPrompt} />
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                      <code>{cryptoPrompt}</code>
                    </pre>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Linear contribution schedule</h2>
          <p>
            Starting deposit <strong>a = $10</strong>, weekly increment <strong>d = $1</strong>, week index <em>t = 1,2,...</em>
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium mb-2">This week's deposit</h3>
              <div className="bg-muted p-3 rounded">
                <div className="font-mono text-sm">
                  c<sub>t</sub> = a + (t-1)d = 10 + (t-1)·1 = t+9
                </div>
                <p className="text-sm text-muted-foreground mt-2">Example: week 52 deposit c₅₂=61</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Total contributed after N weeks</h3>
              <div className="bg-muted p-3 rounded">
                <div className="font-mono text-sm">
                  S<sub>N</sub> = N/2(2a + (N-1)d) = N/2(N+19)
                </div>
                <p className="text-sm text-muted-foreground mt-2">Example: S₅₂ = 1846</p>
              </div>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="utility">
              <AccordionTrigger>Utility (TypeScript)</AccordionTrigger>
              <AccordionContent>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Math utilities</h4>
                  <CopyButton text={utilityCode} />
                </div>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{utilityCode}</code>
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Benchmarks</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">HISA (3% APY, daily comp)</h3>
              <p className="text-sm">
                Daily rate r<sub>d</sub> = (1+0.03)<sup>1/365</sup>-1.
                Each weekly deposit compounds daily from its date: V = Σ deposit<sub>i</sub> · (1+r<sub>d</sub>)<sup>days_since_i</sup>.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium">S&P 500 DCA</h3>
              <p className="text-sm">
                Each week's deposit buys index units at that week's close; units are valued at the latest close.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Limitations</h2>
          <ul className="space-y-2 text-sm">
            <li>Prices are end-of-day snapshots; intraday fills may differ.</li>
            <li>CAD/USD mixing is simplified (CAD-listed preferred; crypto priced in CAD).</li>
            <li>Dividends/distributions are not modeled yet.</li>
            <li>No background automation; <strong>only filled orders</strong> are recorded.</li>
            <li>Candidates must be refreshed weekly; Close Week warns if data is >36h old.</li>
          </ul>
        </section>

        <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Reproducibility</h2>
          <p>
            All calculations live in <code>/lib/math.ts</code> and scripts in this repo. Anyone can replicate outcomes by:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>running the screeners,</li>
            <li>placing the same trades,</li>
            <li>logging fills via the TUI,</li>
            <li>rebuilding the site from the same JSON/CSV.</li>
          </ol>
        </section>
      </div>
    </div>
  )
}