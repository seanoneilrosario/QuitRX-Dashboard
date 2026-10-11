import Link from "next/link";
import styles from "../discounts-components/discounts.module.css";
import DiscountForm from "../discounts-components/DiscountForm";

export default function CreateDiscountPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Discounts</p>
          <h1 className={styles.title}>Create discount</h1>
          <p className={styles.subtitle}>Set the offer, eligibility rules, and combination behaviour.</p>
        </div>
        <Link className={styles.secondaryButton} href="/dashboard/discounts">Back to discounts</Link>
      </header>
      <DiscountForm mode="create" />
    </main>
  );
}
