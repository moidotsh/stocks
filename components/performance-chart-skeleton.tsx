import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PerformanceChartSkeleton() {
  return (
    <div className="w-full space-y-4">
      {/* Controls skeleton */}
      <div className="flex flex-col space-y-3 md:space-y-4">
        {/* View Toggle Buttons skeleton */}
        <div className="flex gap-2 justify-center">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-20 md:w-24" />
          ))}
        </div>
        
        {/* Date Range Selector skeleton */}
        <div className="flex gap-2 justify-center">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-16 md:w-20" />
          ))}
        </div>
      </div>
      
      {/* Chart skeleton */}
      <div className="w-full h-96">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mx-auto" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
