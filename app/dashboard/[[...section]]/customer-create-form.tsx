"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCustomer } from "../customer-actions";
import { ActionButton } from "./action-controls";
import TagsInput from "./tags-input";
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
      <section className={styles.formCard}>
        <h2>Tags</h2>
        <TagsInput initialTags={[]} />
      </section>
      <section className={styles.formCard}>
        <h2>Metafield</h2>
        <div className={styles.formGrid}>
          <label>
            Script expiry
            <input type="date" name="scriptExpiry" />
          </label>
          <label>
            Script ID
            <input name="scriptId" />
          </label>
          <label>
            Consult purchase
            <select name="consultPurchase" defaultValue="false">
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </label>
          <label>
            Birthday
            <input type="date" name="birthday" />
          </label>
          <label>
            Script validity
            <input name="scriptValidity" />
          </label>
          <label>
            Renewal form
            <input name="renewalForm" />
          </label>
          <label>
            Script active
            <select name="scriptActive" defaultValue="false">
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </label>
          <label>
            Gender
            <input name="gender" />
          </label>
          <label>
            Vape tag
            <input name="vapeTag" />
          </label>
          <label>
            Pouch tag
            <input name="pouchTag" />
          </label>
          <label className={styles.full}>
            Document
            <input name="document" />
          </label>
          <label>
            Social login
            <input name="socLogin" />
          </label>
          <label>
            Script uploaded
            <input name="scriptUploaded" />
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
