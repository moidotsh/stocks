import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { CurrencyProvider } from '@/lib/currency-context'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Arman's TFSA Journey",
  description: 'Tracking weekly TFSA investing progress with benchmark comparisons',
  keywords: ['TFSA', 'investing', 'portfolio', 'benchmark', 'S&P 500', 'HISA'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.className, 'min-h-screen flex flex-col')}>
        <CurrencyProvider>
          <Header />
          <main className="flex-1 container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
        </CurrencyProvider>
      </body>
    </html>
  )
}