import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "react-hot-toast"
import { QueryProvider } from "@/providers/QueryProvider"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Maps Lead Engine — İşletme Bulucu",
  description:
    "Google Haritalar üzerinden işletmeleri tarayın, iletişim bilgilerini toplayın ve otomatik mesajlarla iletişime geçin.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-950 text-zinc-100 antialiased`}
      >
        <QueryProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#18181b",
                color: "#f4f4f5",
                border: "1px solid #27272a",
                fontSize: "14px",
              },
              success: {
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#18181b",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#18181b",
                },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  )
}
