import type { Metadata } from 'next'
import { Inter, Noto_Serif_JP, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui'
import './globals.scss'

/**
 * Root layout — the single top-level Server Component that wraps every route.
 *
 * Fonts are loaded with next/font and exposed as CSS variables consumed by the
 * design tokens in globals.scss (`--font-inter`, `--font-noto-serif`,
 * `--font-jetbrains-mono` → `--font-sans` / `--font-display` / `--font-mono`).
 * Japanese-minimal monochrome aesthetic (FRONTEND_DESIGN_SYSTEM.md / DESIGN_TOKENS.md).
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
const notoSerif = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-noto-serif',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
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
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
