"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCustomer } from "../customer-actions";
import { ActionButton } from "./action-controls";
import styles from "./dashboard.module.css";

export default function CustomerCreateForm() {
  const [state, action, pending] = useActionState(createCustomer, { message: "" });

  return (
    <form action={action} className={styles.form}>
      <section className={styles.formCard}>
        <h2>Customer details</h2>
        <div className={styles.formGrid}>
          <label>
            First name
            <input name="firstName" autoComplete="given-name" />
          </label>
          <label>
            Last name
            <input name="lastName" autoComplete="family-name" />
          </label>
          <label>
            Email (required)
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" autoComplete="tel" />
          </label>
        </div>
      </section>
      {state.message && (
        <p role="alert" className={styles.collectionFeedback}>
          {state.message}
        </p>
      )}
      <div className={styles.formActions}>
        <Link href="/dashboard/customers">Cancel</Link>
        <ActionButton className={styles.primary} pending={pending} pendingLabel="Adding customer…">
          Add customer
        </ActionButton>
      </div>
    </form>
  );
}
