import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Holdings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface PortfolioTableProps {
  holdings: Holdings
}

export function PortfolioTable({ holdings }: PortfolioTableProps) {
  const totalMarketValue = holdings.positions.reduce((sum, pos) => 
    sum + (pos.shares * pos.market_price), 0)
  
  const totalUnrealizedPL = holdings.positions.reduce((sum, pos) => 
    sum + ((pos.market_price - pos.avg_cost) * pos.shares), 0)

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Holdings Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Ticker</th>
                <th className="text-right p-3">Shares</th>
                <th className="text-right p-3">Avg Cost</th>
                <th className="text-right p-3">Market Price</th>
                <th className="text-right p-3">Market Value</th>
                <th className="text-right p-3">Unrealized P/L</th>
                <th className="text-left p-3">Currency</th>
              </tr>
            </thead>
            <tbody>
              {holdings.positions.map((position) => {
                const marketValue = position.shares * position.market_price
                const unrealizedPL = (position.market_price - position.avg_cost) * position.shares
                
                return (
                  <tr key={position.ticker} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-mono font-medium">{position.ticker}</td>
                    <td className="text-right p-3">{position.shares.toFixed(3)}</td>
                    <td className="text-right p-3">{formatCurrency(position.avg_cost)}</td>
                    <td className="text-right p-3">{formatCurrency(position.market_price)}</td>
                    <td className="text-right p-3">{formatCurrency(marketValue)}</td>
                    <td className={`text-right p-3 ${
                      unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(unrealizedPL)}
                    </td>
                    <td className="p-3">{position.currency}</td>
                  </tr>
                )
              })}
              
              {holdings.cash_cad > 0 && (
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium">Cash</td>
                  <td className="text-right p-3">-</td>
                  <td className="text-right p-3">-</td>
                  <td className="text-right p-3">-</td>
                  <td className="text-right p-3">{formatCurrency(holdings.cash_cad)}</td>
                  <td className="text-right p-3">-</td>
                  <td className="p-3">CAD</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="p-3">Total</td>
                <td className="text-right p-3">-</td>
                <td className="text-right p-3">-</td>
                <td className="text-right p-3">-</td>
                <td className="text-right p-3">{formatCurrency(totalMarketValue + holdings.cash_cad)}</td>
                <td className={`text-right p-3 ${
                  totalUnrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(totalUnrealizedPL)}
                </td>
                <td className="p-3">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}