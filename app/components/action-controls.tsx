"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ButtonHTMLAttributes, type MouseEvent, type ReactNode, useTransition } from "react";
import { useFormStatus } from "react-dom";
import styles from "./dashboard.module.css";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: string;
};

export function ActionButton({ children, className, disabled, pending: controlledPending, pendingLabel = "Working…", type = "submit", ...props }: ActionButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = controlledPending ?? formPending;
  return <button {...props} type={type} className={`${className ?? ""} ${pending ? styles.actionPending : ""}`.trim()} disabled={disabled || pending} aria-busy={pending}>
    {pending && <span className={styles.actionSpinner} aria-hidden="true"/>}
    {pending ? pendingLabel : children}
  </button>;
}

export function ActionLink({ href, children, pendingLabel = "Loading…", className }: { href: string; children: ReactNode; pendingLabel?: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (pending) return;
    startTransition(() => router.push(href));
  }

  return <Link href={href} className={`${className ?? ""} ${pending ? styles.actionPending : ""}`.trim()} aria-disabled={pending} aria-busy={pending} onClick={navigate}>
    {pending && <span className={styles.actionSpinner} aria-hidden="true"/>}
    {pending ? pendingLabel : children}
  </Link>;
}
