"use client";

import { useActionState } from "react";
import { deleteCollection } from "../actions";
import styles from "./dashboard.module.css";

export default function CollectionDeleteButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteCollection, { message: "", success: false });
  return <>
    <form action={action} onSubmit={(event) => { if (!window.confirm(`Delete “${name}” from the dashboard and storefront?`)) event.preventDefault(); }}>
      <input type="hidden" name="_id" value={id}/>
      <button disabled={pending}>{pending ? "Deleting…" : "Delete"}</button>
    </form>
    {state.message && !state.success && <small role="alert" className={styles.actionError}>{state.message}</small>}
  </>;
}
