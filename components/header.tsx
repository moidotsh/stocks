'use client'

import Link from 'next/link'
import { Github, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  return (
    <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
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
            className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <div className="hidden md:flex items-center space-x-4">
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
            <nav className="flex flex-col space-y-4 pt-4">
              <Link 
                href="/" 
                className="text-sm font-medium hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Overview
              </Link>
              <Link 
                href="/timeline" 
                className="text-sm font-medium hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Timeline
              </Link>
              <Link 
                href="/portfolio" 
                className="text-sm font-medium hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Portfolio
              </Link>
              <Link 
                href="/methodology" 
                className="text-sm font-medium hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Methodology
              </Link>
              <Link 
                href="/admin" 
                className="text-sm font-medium hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Admin
              </Link>
              <Link 
                href="https://github.com/moidotsh/stocks" 
                className="text-sm font-medium hover:text-primary transition-colors flex items-center space-x-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4" />
                <span>View on GitHub</span>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}