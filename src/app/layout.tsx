import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import PermissionModal from "@/components/PermissionModal";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "GroupTrip Ledger — Split Travel Expenses Effortlessly",
  description: "Build itineraries, track shared expenses, and settle debts with the minimum number of payments. Built for group travel.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <LenisProvider>
            <PermissionModal />
            {children}
          </LenisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
