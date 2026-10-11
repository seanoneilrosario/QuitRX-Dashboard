"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./discounts.module.css";
import { Discount } from "@/lib/quitmed-retail-admin/discounts/types";
import { deleteDiscountAction } from "@/lib/quitmed-retail-admin/discounts/discount-actions";

function formatMethod(discount: Discount): string {
  if (discount.method === "PERCENTAGE") return `${discount.value ?? 0}% off`;
  if (discount.method === "FIXED_AMOUNT") return `${discount.value ?? 0} fixed amount`;
  if (discount.method === "BUY_X_GET_Y") return "Buy X Get Y";
  return "Free shipping";
}

function formatScope(scope: Discount["scope"]): string {
  return scope.charAt(0) + scope.slice(1).toLowerCase();
}

export default function DiscountsTable({ discounts }: { discounts: Discount[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return discounts.filter((discount) => {
      const matchesStatus =
        status === "ALL" || (status === "ACTIVE" ? discount.isActive : !discount.isActive);
      const haystack = [discount.name, discount.code ?? "", discount.method, discount.scope]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [discounts, query, status]);

  function handleDelete(discount: Discount) {
    const confirmed = window.confirm(
      `Delete “${discount.name}”? This action may not be reversible.`,
    );
    if (!confirmed) return;

    setFeedback(null);
    startTransition(async () => {
      const result = await deleteDiscountAction(discount.id);
      if (!result.success) {
        setFeedback(result.message ?? "Could not delete this discount.");
        return;
      }
      setFeedback(result.message ?? "Discount deleted.");
      router.refresh();
    });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          aria-label="Search discounts"
          placeholder="Search by name, code, method or scope…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.actions}>
          <label className={styles.muted} htmlFor="discount-status">Status</label>
          <select
            id="discount-status"
            className={styles.select}
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="ALL">All discounts</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {feedback && <p className={styles.error} role="status">{feedback}</p>}

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No discounts found</p>
          <p className={styles.emptyText}>Try another search or create a new discount.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Discount</th>
                <th>Method</th>
                <th>Scope</th>
                <th>Type</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((discount) => (
                <tr key={discount.id}>
                  <td>
                    <Link className={styles.discountName} href={`/dashboard/discounts/view?id=${encodeURIComponent(discount.id)}`}>
                      {discount.name}
                    </Link>
                    <div style={{ marginTop: 6 }}>
                      {discount.code ? (
                        <span className={styles.codeText}>{discount.code}</span>
                      ) : (
                        <span className={styles.muted}>No code</span>
                      )}
                    </div>
                  </td>
                  <td>{formatMethod(discount)}</td>
                  <td>{formatScope(discount.scope)}</td>
                  <td>{discount.isAutomatic ? "Automatic" : "Code"}</td>
                  <td>{discount.usageCount ?? 0}{discount.usageLimit ? ` / ${discount.usageLimit}` : ""}</td>
                  <td>
                    <span className={`${styles.badge} ${discount.isActive ? styles.activeBadge : styles.inactiveBadge}`}>
                      {discount.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link className={styles.inlineLink} href={`/dashboard/discounts/view?id=${encodeURIComponent(discount.id)}`}>View</Link>
                      <Link className={styles.inlineLink} href={`/dashboard/discounts/edit?id=${encodeURIComponent(discount.id)}`}>Edit</Link>
                      <button
                        className={styles.dangerButton}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(discount)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
