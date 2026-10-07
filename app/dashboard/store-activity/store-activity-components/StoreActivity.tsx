"use client";

import Link from "next/link";
import type { StoreActivityItem } from "../../../../lib/quitmed-retail-admin/store-activity/client";
import style from "../../../components/dashboard.module.css";

type StoreActivityProps = {
  activities: StoreActivityItem[];
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resourceName(item: StoreActivityItem): string {
  const newData = objectValue(item.newData);
  const oldData = objectValue(item.oldData);
  const metadata = objectValue(item.metadata);

  const candidates = [
    newData.name,
    oldData.name,
    newData.productName,
    oldData.productName,
    newData.orderNumber,
    oldData.orderNumber,
    newData.firstName && newData.lastName
      ? `${text(newData.firstName)} ${text(newData.lastName)}`
      : undefined,
    oldData.firstName && oldData.lastName
      ? `${text(oldData.firstName)} ${text(oldData.lastName)}`
      : undefined,
    metadata.name,
    metadata.label,
  ];

  return candidates.find((value) => text(value).trim()) as string | undefined ?? "—";
}

function formatFieldName(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "string") {
    return value || "—";
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function changesFor(item: StoreActivityItem) {
  const oldData = objectValue(item.oldData);
  const newData = objectValue(item.newData);

  const keys = Array.from(
    new Set([...Object.keys(oldData), ...Object.keys(newData)]),
  );

  return keys
    .filter((key) => {
      const before = JSON.stringify(oldData[key]);
      const after = JSON.stringify(newData[key]);

      return before !== after;
    })
    .map((field) => ({
      field,
      before: formatValue(oldData[field]),
      after: formatValue(newData[field]),
    }));
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function StoreActivity({
  activities,
}: StoreActivityProps) {
  const sortedActivities = [...activities].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div>
      <div className={style.storeActivityHeader}>
        <span className={style.storeActivityEyebrow}>
          QUITRX OPERATIONS
        </span>

        <h1>Store Activity</h1>

        <p>Review recent changes and actions across your store.</p>
      </div>

      <div className={style.storeActivityTableWrap}>
        <table className={style.storeActivityTable}>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Resource</th>
              <th>Changes</th>
              <th>Source / Staff</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {sortedActivities.map((item, index) => {
              const changes = changesFor(item);

              return (
                <tr key={item.id || `${item.createdAt}-${index}`}>
                  <td>
                    <strong className={style.storeActivityAction}>
                      {item.action}
                    </strong>
                  </td>

                  <td>
                    <div className={style.storeActivityResource}>
                      <strong>{item.entityType || "—"}</strong>
                      <span>{resourceName(item)}</span>
                      {item.entityId ? (
                        <span>{item.entityId}</span>
                      ) : null}
                    </div>
                  </td>

                  <td>
                    <div className={style.storeActivityChanges}>
                      {changes.length > 0 ? (
                        changes.map((change) => (
                          <div
                            key={change.field}
                            className={style.storeActivityChange}
                          >
                            <strong>
                              {formatFieldName(change.field)}
                            </strong>

                            <span className={style.storeActivityValueBefore}>
                              {change.before}
                            </span>

                            <span
                              className={style.storeActivityArrow}
                              aria-hidden="true"
                            >
                              →
                            </span>

                            <span className={style.storeActivityValueAfter}>
                              {change.after}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span>
                          {item.action === "CREATE"
                            ? "Record created"
                            : item.action === "DELETE"
                              ? "Record deleted"
                              : "—"}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className={style.storeActivitySource}>
                      <span className={style.storeActivityBadge}>
                        {item.source || "UNKNOWN"}
                      </span>

                      <span>—</span>
                    </div>
                  </td>

                  <td>
                    <time className={style.storeActivityDate}>
                      {formatDate(item.createdAt)}
                    </time>
                  </td>

                  <td>
                    <Link
                      href={`/dashboard/store-activity/view?id=${encodeURIComponent(item.id)}`}
                      className={style.storeActivityViewButton}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}