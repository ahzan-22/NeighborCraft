import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import NotificationBell from "../components/NotificationBell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeighborCraft",
  description: "Platform jasa antar warga sekitar",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b-4 border-black bg-black text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-lg font-black uppercase">
              🛠️ Neighbor<span className="bg-[#FFE600] px-1 text-black">Craft</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                href="/services"
                className="border-[3px] border-white px-3 py-1.5 text-xs font-black uppercase"
              >
                Cari Jasa
              </Link>
              <Link
                href="/dashboard/provider"
                className="border-[3px] border-white px-3 py-1.5 text-xs font-black uppercase"
              >
                Penyedia
              </Link>
              <Link
                href="/dashboard/orders"
                className="border-[3px] border-white px-3 py-1.5 text-xs font-black uppercase"
              >
                Pesanan
              </Link>
              <NotificationBell />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
