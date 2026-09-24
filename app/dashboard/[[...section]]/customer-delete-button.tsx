"use client";

import { useActionState } from "react";
import { deleteCustomer } from "../customer-actions";
import { ActionButton } from "./action-controls";
import styles from "./dashboard.module.css";

export default function CustomerDeleteButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteCustomer, { message: "" });

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete customer "${name}"? This action cannot be undone.`))
          event.preventDefault();
      }}
    >
      <input type="hidden" name="customerId" value={id} />
      <ActionButton className={styles.orderCancelButton} pending={pending} pendingLabel="Deleting…" disabled={!id}>
        Delete customer
      </ActionButton>
      {state.message && <p role="alert" className={styles.actionError}>{state.message}</p>}
    </form>
  );
}
