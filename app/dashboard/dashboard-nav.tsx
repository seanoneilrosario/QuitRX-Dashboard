
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../components/dashboard.module.css";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂" },
  { label: "Products", href: "/dashboard/products", icon: "□" },
  { label: "Collections", href: "/dashboard/collections", icon: "◇" },
  { label: "Bundles", href: "/dashboard/bundles", icon: "+" },
  { label: "Customers", href: "/dashboard/customers", icon: "♙" },
  {
    label: "Customers Segment",
    href: "/dashboard/customer-segments",
    icon: "♙",
  },
  { label: "Discounts", href: "/dashboard/discounts", icon: "▤" },
  { label: "Orders", href: "/dashboard/orders", icon: "▤" },
  { label: "Filters", href: "/dashboard/metafields", icon: "▥" },
  {
    label: "Store Activity",
    href: "/dashboard/store-activity",
    icon: "↻",
  },
];

export default function DashboardNav({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav>
      {nav.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? styles.activeNavLink : undefined}
            aria-current={
              pathname === item.href ? "page" : undefined
            }
          >
            {!mobile && <i>{item.icon}</i>}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
