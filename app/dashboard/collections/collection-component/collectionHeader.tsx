import { ActionLink } from "@/app/components/action-controls";
import styles from "@/app/components/dashboard.module.css";

export default function CollectionHeader() {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>QuitRX operations</p>

        <h1>Collections</h1>

        <p>
          Group products into manual or dynamic storefront collections.
        </p>
      </div>

      <ActionLink
        className={styles.primary}
        href="/dashboard/collections/create"
        pendingLabel="Loading…"
      >
        + Add collection
      </ActionLink>
    </header>
  );
}