"use client";

import { useState } from "react";
import { startInvoicePayment } from "./actions";
import styles from "./invoice-payment.module.css";

export default function PaymentButton({ token }: { token: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    if (isPending) return;
    setIsPending(true);
    setError("");

    const result = await startInvoicePayment(token);

    if (!result.success) {
      setError(result.message);
      setIsPending(false);
      return;
    }

    window.location.assign(result.redirectUrl);
  }

  return (
    <div className={styles.paymentAction}>
      <button
        type="button"
        className={styles.payButton}
        disabled={isPending}
        onClick={pay}
      >
        {isPending ? "Connecting securely..." : "Pay Invoice Securely"}
      </button>
      <p className={styles.secureNote}>
        <span aria-hidden="true">&#128274;</span> Secure payment powered by Eway
      </p>
      {error && (
        <p className={styles.actionError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
