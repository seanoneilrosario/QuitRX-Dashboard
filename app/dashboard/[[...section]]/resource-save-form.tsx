"use client";

import { type ReactNode, useActionState } from "react";
import { saveResourceWithState } from "../actions";
import styles from "./dashboard.module.css";

export default function ResourceSaveForm({ children, className, processingLabel }: { children: ReactNode; className?: string; processingLabel?: string }) {
  const [state, action, pending] = useActionState(saveResourceWithState, { message: "", success: false });

  return <form action={action} className={className}>
    {children}
    {pending && processingLabel && <div className={styles.bundleLoadingModal} role="status" aria-live="polite">
      <div><span className={styles.bundleLoadingSpinner} aria-hidden="true"/><strong>{processingLabel}</strong><small>Please wait while your changes are saved.</small></div>
    </div>}
    {state.message && <p role="alert" className={styles.collectionFeedback}>{state.message}</p>}
  </form>;
}
