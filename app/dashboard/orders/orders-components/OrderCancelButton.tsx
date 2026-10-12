
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import style from "../../../components/dashboard.module.css";
import { cancelOrderAction } from "../../../../lib/quitmed-retail-admin/orders/order-actions";

export default function OrderCancelButton({
  orderId,
}: {
  orderId: string;
}) {
  const router = useRouter();

  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCancel() {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this order? This will run the backend cancellation workflow.",
    );

    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      const result = await cancelOrderAction(orderId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel order.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "6px",
      }}
    >
      <button
        type="button"
        onClick={handleCancel}
        disabled={isCancelling || success}
        style={{
          padding: "10px 14px",
          border: "1px solid #dc2626",
          borderRadius: "8px",
          background: success ? "#6b7280" : "#dc2626",
          color: "#ffffff",
          fontWeight: 600,
          cursor:
            isCancelling || success
              ? "not-allowed"
              : "pointer",
          opacity: isCancelling ? 0.7 : 1,
        }}
      >
        {isCancelling
          ? "Cancelling..."
          : success
            ? "Cancelled"
            : "Cancel order"}
      </button>

      {error && (
        <span
          role="alert"
          style={{
            color: "#dc2626",
            fontSize: "12px",
            maxWidth: "240px",
          }}
        >
          {error}
        </span>
      )}
    </span>
  );
}
