export function Footer() {
  
  return (
    <footer className="border-t bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-sm text-muted-foreground">
            © 2025 Arman&apos;s TFSA Journey. Built with Next.js and shadcn/ui.
          </p>
          
          <p className="text-sm text-muted-foreground text-center md:text-right">
            <strong>Disclaimer:</strong> Not investment advice. Data may be delayed or approximate.
          </p>
        </div>
      </div>
    </footer>
  )
}