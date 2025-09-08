import { describe, it, expect } from 'vitest'
import { calculateHisaValue, calculateSP500DCA, calculateIRR } from '../lib/math'

describe('Math utilities', () => {
  describe('calculateHisaValue', () => {
    it('should calculate HISA value with daily compounding', () => {
      const flows = [
        { date: '2025-01-01', amount: 100 }
      ]
      
      // After 365 days at 3% APY
      const asOf = new Date('2026-01-01')
      const result = calculateHisaValue(flows, 0.03, asOf)
      
      // Should be approximately 103 (100 * 1.03)
      expect(result).toBeCloseTo(103, 0)
    })
    
    it('should handle multiple cash flows', () => {
      const flows = [
        { date: '2025-01-01', amount: 100 },
        { date: '2025-07-01', amount: 100 }
      ]
      
      const asOf = new Date('2026-01-01')
      const result = calculateHisaValue(flows, 0.03, asOf)
      
      // Should be greater than 200 but less than 206
      expect(result).toBeGreaterThan(200)
      expect(result).toBeLessThan(206)
    })
  })
  
  describe('calculateSP500DCA', () => {
    it('should calculate S&P 500 DCA correctly', () => {
      const flows = [
        { date: '2025-01-01', amount: 1000 }
      ]
      
      const levels = [
        { date: '2025-01-01', level: 5000 },
        { date: '2025-12-31', level: 5500 }
      ]
      
      const result = calculateSP500DCA(flows, levels)
      
      // Bought 1000/5000 = 0.2 units at 5000
      // Now worth 0.2 * 5500 = 1100
      expect(result).toBe(1100)
    })
  })
  
  describe('calculateIRR', () => {
    it('should calculate IRR for simple case', () => {
      const cashflows = [
        { date: '2025-01-01', amount: -1000 }, // Investment
        { date: '2026-01-01', amount: 1100 }   // Return
      ]
      
      const irr = calculateIRR(cashflows)
      
      // 10% return over 1 year
      expect(irr).toBeCloseTo(0.1, 2)
    })
    
    it('should handle multiple cash flows', () => {
      const cashflows = [
        { date: '2025-01-01', amount: -1000 },
        { date: '2025-07-01', amount: -1000 },
        { date: '2026-01-01', amount: 2200 }
      ]
      
      const irr = calculateIRR(cashflows)
      
      // Should be positive but reasonable
      expect(irr).toBeGreaterThan(0)
      expect(irr).toBeLessThan(0.5)
    })
  })
})