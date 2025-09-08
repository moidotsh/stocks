import Link from 'next/link'
import { Github } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
              Arman's TFSA Journey
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
          
          <div className="flex items-center space-x-4">
            <Link 
              href="https://github.com/username/tfsa-tracker" 
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">View on GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}