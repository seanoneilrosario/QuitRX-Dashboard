"use client";

import Link from "next/link";
import { useState } from "react";

import type { CustomerSegment } from "@/lib/quitmed-retail-admin/customer-segments/client";

import styles from "./customer-segments.module.css";
import { refreshCustomerSegmentAction } from "@/lib/quitmed-retail-admin/customer-segments/customer-segment-actions";

type Props = {
  initialSegments: CustomerSegment[];
};

export default function CustomerSegmentsList({
  initialSegments,
}: Props) {
  const [segments, setSegments] = useState(initialSegments);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRefresh(id: string) {
    setError("");
    setSuccess("");
    setRefreshingId(id);

    try {
      const result = await refreshCustomerSegmentAction(id);

      setSegments((current) =>
        current.map((segment) =>
          segment.id === id
            ? {
                ...segment,
                _count: { members: result.matchedCustomers },
              }
            : segment,
        ),
      );

      setSuccess(
        `Segment refreshed. ${result.matchedCustomers} customers matched.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to refresh segment.",
      );
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CUSTOMERS</p>
          <h1>Customer segments</h1>
          <p className={styles.subtitle}>
            Organize customers using attributes, purchase activity, dates, and tags.
          </p>
        </div>

        <Link
          href="/dashboard/customer-segments/create"
          className={styles.primaryButton}
        >
          + Create segment
        </Link>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>All segments</h2>
            <p>View matching customers or manage segment rules.</p>
          </div>

          <span className={styles.count}>
            {segments.length} total
          </span>
        </div>

        {segments.length === 0 ? (
          <div className={styles.empty}>
            <p>No customer segments yet.</p>
            <Link href="/dashboard/customer-segments/create">
              Create your first segment
            </Link>
          </div>
        ) : (
          <div className={styles.segmentList}>
            {segments.map((segment) => (
              <article
                className={styles.segmentCard}
                key={segment.id}
              >
                <div className={styles.segmentInfo}>
                  <div className={styles.segmentTitle}>
                    <h3>{segment.name}</h3>

                    <span
                      className={
                        segment.isActive
                          ? styles.activeBadge
                          : styles.inactiveBadge
                      }
                    >
                      {segment.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {segment.description && (
                    <p>{segment.description}</p>
                  )}

                  <div className={styles.metadata}>
                    <span>
                      Match {segment.matchMode === "ALL" ? "all" : "any"}
                    </span>

                    <span>
                      {segment.rules?.length ?? 0} conditions
                    </span>

                    <strong>
                      {segment._count?.members ?? 0} customers
                    </strong>
                  </div>
                </div>

                <div className={styles.segmentActions}>
                  <Link
                    href={`/dashboard/customer-segments/view?id=${encodeURIComponent(segment.id)}`}
                    className={styles.secondaryButton}
                  >
                    View customers
                  </Link>

                  <Link
                    href={`/dashboard/customer-segments/edit?id=${encodeURIComponent(segment.id)}`}
                    className={styles.secondaryButton}
                  >
                    Edit
                  </Link>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={refreshingId === segment.id}
                    onClick={() => handleRefresh(segment.id)}
                  >
                    {refreshingId === segment.id
                      ? "Refreshing..."
                      : "Refresh"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}