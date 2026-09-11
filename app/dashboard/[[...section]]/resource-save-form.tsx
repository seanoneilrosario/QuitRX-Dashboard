"use client";

import { type ReactNode, useActionState } from "react";
import { saveResourceWithState } from "../actions";
import styles from "./dashboard.module.css";

export default function ResourceSaveForm({ children, className }: { children: ReactNode; className?: string }) {
  const [state, action] = useActionState(saveResourceWithState, { message: "", success: false });

  return <form action={action} className={className}>
    {children}
    {state.message && <p role="alert" className={styles.collectionFeedback}>{state.message}</p>}
  </form>;
}
