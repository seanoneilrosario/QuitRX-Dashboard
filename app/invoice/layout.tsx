import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice payment | QuitRX",
  description: "Securely view and pay a QuitRX invoice.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default function InvoiceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
