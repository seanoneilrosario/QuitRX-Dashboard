import Link from "next/link";
import styles from "./discounts-components/discounts.module.css";
import { listDiscounts } from "@/lib/quitmed-retail-admin/discounts/client";
import DiscountsTable from "./discounts-components/DiscountsTable";
import { Discount } from "@/lib/quitmed-retail-admin/discounts/types";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  let discounts: Discount[] = [];
  let errorMessage: string | null = null;

  try {
    discounts = await listDiscounts();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load discounts.";
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Retail administration</p>
          <h1 className={styles.title}>Discounts</h1>
          <p className={styles.subtitle}>Manage promotional codes, automatic discounts, eligibility and combinations.</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.button} href="/dashboard/discounts/create">Create discount</Link>
        </div>
      </header>

      {errorMessage ? (
        <div className={styles.error} role="alert">
          <strong>Could not load discounts.</strong> {errorMessage}
          <p style={{ marginBottom: 0 }}>Check the retail API URL and authentication environment variables on the Next.js server.</p>
        </div>
      ) : (
        <>
          <p className={styles.muted} style={{ margin: "0 0 14px" }}>{discounts.length} discount{discounts.length === 1 ? "" : "s"}</p>
          <DiscountsTable discounts={discounts} />
        </>
      )}
    </main>
  );
}
