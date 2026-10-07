"use client";

import { useActionState } from "react";

import styles from "@/app/components/dashboard.module.css";

import { deleteCollection } from "@/lib/quitmed-retail-admin/collections/actions";

export default function CollectionDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    deleteCollection,
    {
      message: "",
      success: false,
    },
  );

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Are you sure you want to delete "${name}"? This cannot be undone.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="_id"
        value={id}
      />

      <button
        type="submit"
        className={styles.danger}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>

      {state.message && !state.success && (
        <p role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}