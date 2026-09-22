"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "../actions";
import styles from "./dashboard.module.css";
import { ActionButton } from "./action-controls";

export default function OrderCancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(cancelOrder, {
    message: "",
    success: false,
  });

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className={styles.orderCancelAction}>
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm("Cancel this order? This action cannot be undone.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="orderId" value={orderId} />
        <ActionButton
          className={styles.orderCancelButton}
          pending={pending}
          pendingLabel="Cancelling…"
        >
          Cancel Order
        </ActionButton>
      </form>
      {state.message && !state.success ? (
        <small role="alert" className={styles.actionError}>{state.message}</small>
      ) : null}
    </div>
  );
}
