import type { Metadata } from 'next'
import { Inter, Noto_Serif_JP, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui'
import './globals.scss'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Noto Serif JP — the display/heading font.
// variable name --noto-serif avoids circular reference with --font-heading token.
const notoSerif = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600'],
  variable: '--noto-serif',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Watcon Management Software',
  description: 'Watcon Business Management System',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head />
      {/* suppressHydrationWarning: browser extensions (password managers,
          form fillers) inject attributes on <body> before hydration, which
          would otherwise trigger a hydration mismatch warning. */}
      <body suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
