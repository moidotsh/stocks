'use client'

import Link from 'next/link'
import { Github, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useCurrency } from '@/lib/currency-context'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isSwedishMode, exchangeRate } = useCurrency()
  return (
    <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 md:space-x-8">
            <Link href="/" className="text-lg md:text-xl font-bold truncate">
              Arman&apos;s TFSA Journey
            </Link>
            
            <nav className="hidden md:flex space-x-6">
              <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
                Overview
              </Link>
              <Link href="/timeline" className="text-sm font-medium hover:text-primary transition-colors">
                Timeline
              </Link>
              <Link href="/portfolio" className="text-sm font-medium hover:text-primary transition-colors">
                Portfolio
              </Link>
              <Link href="/llm-workflow" className="text-sm font-medium hover:text-primary transition-colors">
                LLM Workflow
              </Link>
              <Link href="/trades/record" className="text-sm font-medium hover:text-primary transition-colors">
                Record Trades
              </Link>
              <Link href="/methodology" className="text-sm font-medium hover:text-primary transition-colors">
                Methodology
              </Link>
              <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">
                Admin
              </Link>
            </nav>
          </div>
          
          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors touch-manipulation"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <div className="hidden md:flex items-center space-x-4">
            {/* Currency indicator */}
            {isSwedishMode && exchangeRate && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                <span>SEK Mode</span>
                <span className="text-blue-600 dark:text-blue-300">{exchangeRate.toFixed(2)}</span>
              </div>
            )}
            <Link 
              href="https://github.com/moidotsh/stocks" 
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">View on GitHub</span>
            </Link>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t">
            {/* Mobile currency indicator */}
            {isSwedishMode && exchangeRate && (
              <div className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-medium mt-4">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                <span>SEK Mode Active</span>
                <span className="text-blue-600 dark:text-blue-300">{exchangeRate.toFixed(2)}</span>
              </div>
            )}
            <nav className="flex flex-col space-y-1 pt-4">
              <Link 
                href="/" 
                className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent touch-manipulation"
                onClick={() => setIsMenuOpen(false)}
              >
                Overview
              </Link>
              <Link 
                href="/timeline" 
                className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent touch-manipulation"
                onClick={() => setIsMenuOpen(false)}
              >
                Timeline
              </Link>
              <Link 
                href="/portfolio" 
                className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent touch-manipulation"
                onClick={() => setIsMenuOpen(false)}
              >
                Portfolio
              </Link>
              <Link 
                href="/llm-workflow" 
                className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent touch-manipulation"
                onClick={() => setIsMenuOpen(false)}
              >
                LLM Workflow
              </Link>
              <Link 
                href="/trades/record" 
                className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent touch-manipulation"
                onClick={() => setIsMenuOpen(false)}
              >
                Record Trades
              </Link>
              <Link 
                href="/methodology" 
                className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent touch-manipulation"
                onClick={() => setIsMenuOpen(false)}
              >
                Methodology
              </Link>
              <Link 
                href="/admin" 
                className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent touch-manipulation"
                onClick={() => setIsMenuOpen(false)}
              >
                Admin
              </Link>
              <div className="pt-2 border-t mt-2">
                <Link 
                  href="https://github.com/moidotsh/stocks" 
                  className="text-sm font-medium hover:text-primary transition-colors py-3 px-2 rounded-lg hover:bg-accent flex items-center space-x-2 touch-manipulation"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Github className="h-4 w-4" />
                  <span>View on GitHub</span>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}