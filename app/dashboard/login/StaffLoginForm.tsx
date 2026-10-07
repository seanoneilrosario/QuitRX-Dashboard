"use client";

import { useActionState } from "react";
import { loginStaff, type StaffLoginState } from "./actions";
import styles from "./staffLogin.module.css";

const initialState: StaffLoginState = {};

export default function StaffLoginForm() {
  const [state, action, pending] = useActionState(loginStaff, initialState);
  return (
    <form action={action} className={styles.form}>
      <label>Email address<input name="email" type="email" autoComplete="username" required autoFocus /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button disabled={pending}>{pending ? "Signing in…" : "Sign in to dashboard"}</button>
    </form>
  );
}

