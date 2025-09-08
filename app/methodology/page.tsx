export default function MethodologyPage() {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Methodology</h1>
          <p className="text-muted-foreground">
            How we calculate returns and benchmark comparisons
          </p>
        </div>
  
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Data Sources</h2>
            <p>
              All portfolio data is manually maintained in JSON files within this repository:
            </p>
            <ul>
              <li><strong>entries.json</strong> - Weekly trading activity and contributions</li>
              <li><strong>holdings.json</strong> - Current portfolio positions and market prices</li>
              <li><strong>benchmarks.json</strong> - S&P 500 weekly closes and HISA rate</li>
            </ul>
          </section>
  
          <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Return Calculations</h2>
            
            <h3 className="text-lg font-medium">Time-Weighted Return (TWR)</h3>
            <p>
              Measures portfolio performance independent of cash flows. Calculated by linking 
              periodic returns, effectively showing how well the investment strategy performed.
            </p>
  
            <h3 className="text-lg font-medium">Money-Weighted Return (IRR)</h3>
            <p>
              Internal Rate of Return considering the timing and size of cash flows. 
              Calculated using Newton-Raphson method with bisection fallback.
            </p>
          </section>
  
          <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Benchmark Calculations</h2>
            
            <h3 className="text-lg font-medium">HISA Benchmark (3% APY)</h3>
            <p>
              Each weekly deposit is treated as a cash flow into a High-Interest Savings Account 
              earning 3% annually, compounded daily using a 365-day basis:
            </p>
            <code className="block bg-muted p-2 rounded text-sm">
              daily_rate = (1 + annual_rate)^(1/365) - 1<br/>
              value = principal * (1 + daily_rate)^days
            </code>
  
            <h3 className="text-lg font-medium">S&P 500 Dollar-Cost Averaging</h3>
            <p>
              Each weekly deposit is treated as purchasing S&P 500 index units at that week's 
              closing level. The accumulated units are then marked to the latest index level.
            </p>
          </section>
  
          <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Limitations</h2>
            <ul>
              <li>Market prices may be delayed or approximated</li>
              <li>Historical price data may be incomplete</li>
              <li>Currency conversion not applied (CAD/USD mixed)</li>
              <li>No adjustment for dividends or distributions</li>
              <li>Benchmark data updated manually weekly</li>
            </ul>
          </section>
  
          <section className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Reproducing Results</h2>
            <p>
              All calculations are implemented in <code>/lib/math.ts</code> and can be 
              independently verified. The complete data set and calculation logic are 
              open source in this repository.
            </p>
          </section>
        </div>
      </div>
    )
  }