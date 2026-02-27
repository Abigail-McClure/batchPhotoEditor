import type { Metadata } from 'next'
import { Quicksand } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
})

export const metadata: Metadata = {
  title: 'Batch Photo Editor',
  description: 'Edit one photo, apply the same look to all.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body className="font-quicksand bg-white text-gray-800 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
