import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "QuitRX Dashboard", template: "%s | QuitRX Dashboard" },
  description: "QuitRX staff operations dashboard",
  icons: { icon: "/favicon.ico", shortcut: "/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
