import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "./query-provider";

export const metadata: Metadata = {
  title: { default: "QuitRX Dashboard", template: "%s | QuitRX Dashboard" },
  description: "QuitRX staff operations dashboard",
  icons: { icon: "/favicon.ico", shortcut: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}