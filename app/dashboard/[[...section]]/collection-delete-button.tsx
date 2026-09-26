"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { deleteCollection } from "../actions";
import styles from "./dashboard.module.css";
import { ActionButton } from "./action-controls";

export default function CollectionDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (previous: { message: string; success: boolean }, formData: FormData) => {
    const result = await deleteCollection(previous, formData);
    if (result.success) router.replace("/dashboard/collections");
    return result;
  }, { message: "", success: false });
  return <>
    <form action={action} onSubmit={(event) => { if (!window.confirm(`Delete “${name}” from the dashboard and storefront?`)) event.preventDefault(); }}>
      <input type="hidden" name="_id" value={id}/>
      <ActionButton className={styles.collectionDeleteButton} pending={pending} disabled={state.success} pendingLabel="Deleting…">Delete</ActionButton>
    </form>
    {state.message && <p role={state.success ? "status" : "alert"} className={`${styles.collectionFeedback} ${state.success ? styles.success : ""}`}>{state.message}</p>}
  </>;
}
