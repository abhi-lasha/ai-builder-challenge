import type { Metadata } from "next";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Lab Asset Tracking",
    default: "Lab Asset Tracking",
  },
  description: "Track lab equipment across all sites — receiving, storage, deployment, and reconciliation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Skip link — keyboard users jump straight to content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-blue-700 focus:shadow-lg focus:ring-2 focus:ring-blue-500"
        >
          Skip to main content
        </a>
        <header className="border-b bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              Asset tracking
            </a>
            <RoleSwitcher />
          </div>
        </header>
        <main id="main-content" className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
