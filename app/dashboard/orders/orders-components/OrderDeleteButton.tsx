"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { deleteOrderAction } from "../../../../lib/quitmed-retail-admin/orders/order-actions";

import style from "../../../components/dashboard.module.css";

export default function OrderDeleteButton({
  orderId,
}: {
  orderId: string;
}) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState<string | null>(null);

  const [deleteSuccess, setDeleteSuccess] =
    useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this order? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteOrderAction(orderId);

    if (!result.success) {
      setDeleteError(
        result.error ?? "Failed to delete order.",
      );
      setIsDeleting(false);
      return;
    }

    setDeleteSuccess(true);

    setTimeout(() => {
      router.push("/dashboard/orders");
    }, 1000);
  }

  return (
    <>
      {deleteSuccess && (
        <div
          className={style.deleteSuccessPopup}
          role="status"
        >
          Order deleted successfully.
        </div>
      )}

      {deleteError && (
        <div
          className={style.notice}
          role="alert"
        >
          {deleteError}
        </div>
      )}

      <button
        type="button"
        className={style.customerDeleteButton}
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting
          ? "Deleting..."
          : "Delete order"}
      </button>
    </>
  );
}