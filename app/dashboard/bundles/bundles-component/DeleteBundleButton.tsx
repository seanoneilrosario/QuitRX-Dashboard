"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteProductBundleAction,
} from "../../../../lib/quitmed-retail-admin/bundles/actions";

import style from "../../../components/dashboard.module.css";

export default function DeleteBundleButton({
  productId,
  variantId,
}: {
  productId: string;
  variantId: string;
}) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this bundle?",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      console.log("Deleting bundle:", {
        productId,
        variantId,
      });

      const result =
        await deleteProductBundleAction(
          productId,
          variantId,
        );

      router.push("/dashboard/bundles");
    } catch (deleteError) {
      console.error(
        "Delete bundle failed:",
        deleteError,
      );

      setError("Failed to delete bundle.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={style.secondary}
        onClick={() => void handleDelete()}
        disabled={isDeleting}
      >
        {isDeleting
          ? "Deleting..."
          : "Delete bundle"}
      </button>

      {error && (
        <p role="alert">
          {error}
        </p>
      )}
    </>
  );
}