import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SamYemenMarket — Seller Center",
  description: "لوحة تحكم التاجر",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
