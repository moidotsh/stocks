import { Skeleton } from '@/components/ui/skeleton'

export function PerformanceChartSkeleton() {
  return (
    <div className="w-full space-y-4">
      {/* Controls skeleton */}
      <div className="space-y-4">
        {/* View Selector skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="flex-1 h-8 rounded-md" />
            ))}
          </div>
        </div>
        
        {/* Time Range Selector skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-1 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="flex-shrink-0 h-8 w-16 rounded-md" />
            ))}
          </div>
        </div>
      </div>
      
      {/* Chart skeleton */}
      <div className="w-full h-96">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
      
      {/* Mobile Legend skeleton */}
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="w-3 h-0.5 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
