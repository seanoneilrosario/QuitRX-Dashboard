import Link from "next/link";

import { ActionButton } from "../components/action-controls";
import styles from "../components/dashboard.module.css";

import { logoutStaff } from "./login/actions";

const nav = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "⌂",
  },
  {
    label: "Products",
    href: "/dashboard/products",
    icon: "□",
  },
  {
    label: "Collections",
    href: "/dashboard/collections",
    icon: "◇",
  },
  {
    label: "Bundles",
    href: "/dashboard/bundles",
    icon: "+",
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: "♙",
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: "▤",
  },
  {
    label: "Filters",
    href: "/dashboard/metafields",
    icon: "▥",
  },
  {
    label: "Store Activity",
    href: "/dashboard/store-activity",
    icon: "↻",
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside>
        <Link
          className={styles.logo}
          href="/"
        >
          <span>Q</span>
          <strong>QuitRX</strong>
        </Link>

        <nav>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
            >
              <i>{item.icon}</i>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.profile}>
          <span>ST</span>

          <div>
            <strong>Staff account</strong>
            <small>Operations</small>
          </div>

          <form action={logoutStaff}>
            <ActionButton pendingLabel="Signing out…">
              Logout
            </ActionButton>
          </form>
        </div>
      </aside>

      <main>
        <div id="dashboard-top" />

        <div className={styles.mobileTop}>
          <Link
            className={styles.logo}
            href="/"
          >
            <span>Q</span>
            <strong>QuitRX</strong>
          </Link>

          <nav>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={logoutStaff}>
            <ActionButton pendingLabel="Signing out…">
              Logout
            </ActionButton>
          </form>
        </div>

        {children}
      </main>
    </div>
  );
}