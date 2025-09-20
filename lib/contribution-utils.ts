// Contribution calculation utilities for the TFSA experiment
export const CONTRIBUTION_FORMULA = {
  // Base amount: $10 per portfolio in Week 1
  // Weekly increment: $1 per week per portfolio
  // Formula: 10 + (weekNumber - 1) for each portfolio
  // Total: (10 + (weekNumber - 1)) * 2 for both portfolios

  getContributionPerPortfolio: (weekNumber: number): number => {
    return 10 + (weekNumber - 1) // Week 1: $10, Week 2: $11, Week 3: $12
  },

  getTotalContribution: (weekNumber: number): number => {
    return (10 + (weekNumber - 1)) * 2 // 2 portfolios (stock + crypto)
  },

  getHistoricalTotalContributed: (currentWeek: number): number => {
    // Sum of all contributions up to current week
    let total = 0
    for (let week = 1; week < currentWeek; week++) {
      total += (10 + (week - 1)) * 2
    }
    return total
  },

  getWeekNumber: (date: Date = new Date()): number => {
    // Week 1: Sep 7-13, 2025
    // Week 2: Sep 14-20, 2025
    // Week 3: Sep 21-27, 2025
    // etc.

    const startDate = new Date('2025-09-07') // Week 1 start
    const diffTime = Math.abs(date.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.floor(diffDays / 7) + 1
  },

  getWeekDateRange: (weekNumber: number): string => {
    const startDate = new Date('2025-09-07') // Week 1 start
    const weekStart = new Date(startDate.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)

    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
    const startDay = weekStart.getDate()
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
    const endDay = weekEnd.getDate()

    return `${startMonth} ${startDay}-${endMonth === startMonth ? endDay : `${endMonth} ${endDay}`}`
  }
}