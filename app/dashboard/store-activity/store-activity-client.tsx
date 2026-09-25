"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import type { RetailRecord } from "@/lib/quithero-admin";
import { getStoreActivityBatch } from "../actions";
import styles from "../[[...section]]/dashboard.module.css";

function text(value: unknown, fallback = "—") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function nested(item: RetailRecord, key: string) {
  const value = item[key];
  return value && typeof value === "object"
    ? (value as RetailRecord)
    : undefined;
}

function orderDate(value: unknown) {
  const date = new Date(text(value, ""));
  return Number.isNaN(date.getTime())
    ? text(value)
    : new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function auditValue(item: RetailRecord, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function auditActor(item: RetailRecord) {
  const actor =
    nested(item, "user") ??
    nested(item, "staff") ??
    nested(item, "actor");

  if (actor) {
    const name = [
      text(actor.firstName, ""),
      text(actor.lastName, ""),
    ]
      .filter(Boolean)
      .join(" ");

    return (
      name ||
      auditValue(actor, ["email", "name", "id"])
    );
  }

  return auditValue(item, [
    "staffEmail",
    "userEmail",
    "actorEmail",
    "userId",
    "staffId",
  ]);
}

function auditEntityLabel(item: RetailRecord) {
  const entity =
    nested(item, "newData") ??
    nested(item, "oldData");

  if (!entity) return "";

  const name = [
    text(entity.firstName, ""),
    text(entity.lastName, ""),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    name ||
    auditValue(entity, [
      "name",
      "title",
      "email",
      "sku",
      "orderNumber",
    ])
  );
}

function auditDataValue(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "None";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (
    Array.isArray(value) &&
    value.every(
      (entry) => typeof entry !== "object",
    )
  ) {
    return value.length
      ? value.join(", ")
      : "None";
  }

  return "Updated";
}

function auditChanges(item: RetailRecord) {
  const oldData = nested(item, "oldData");
  const newData = nested(item, "newData");

  if (!oldData || !newData) return [];

  return Object.keys(newData)
    .filter(
      (key) =>
        key in oldData &&
        JSON.stringify(oldData[key]) !==
          JSON.stringify(newData[key]),
    )
    .map((key) => ({
      field: key.replace(
        /([a-z])([A-Z])/g,
        "$1 $2",
      ),
      before: auditDataValue(oldData[key]),
      after: auditDataValue(newData[key]),
    }));
}

function AuditDetails({
  item,
}: {
  item: RetailRecord;
}) {
  const changes = auditChanges(item);

  if (changes.length) {
    return (
      <div className={styles.activityChanges}>
        {changes.map((change) => (
          <div key={change.field}>
            <strong>{change.field}</strong>
            <span>{change.before}</span>
            <i aria-hidden="true">→</i>
            <span>{change.after}</span>
          </div>
        ))}
      </div>
    );
  }

  const details =
    item.details ??
    item.metadata ??
    item.changes ??
    item.payload;

  const summary = auditValue(item, [
    "description",
    "message",
    "summary",
  ]);

  if (summary) return summary;

  if (
    typeof details === "string" ||
    typeof details === "number"
  ) {
    return String(details);
  }

  return auditValue(item, ["action"]) ===
    "CREATE"
    ? "Record created"
    : auditValue(item, ["action"]) ===
        "DELETE"
      ? "Record deleted"
      : "—";
}

function Header({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>
          QuitRX operations
        </p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function Notice({
  message,
}: {
  message?: string;
}) {
  return message ? (
    <div className={styles.notice}>
      <strong>API connection needed</strong>
      <span>{message}</span>
    </div>
  ) : null;
}

function Status({
  value,
}: {
  value: unknown;
}) {
  const label = text(value, "ACTIVE");

  return (
    <span
      className={`${styles.status} ${
        /draft|pending|low/i.test(label)
          ? styles.warning
          : ""
      }`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

function Table({
  heads,
  children,
}: {
  heads: string[];
  children: ReactNode;
}) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function StoreActivity() {
  const [page, setPage] = useState(1);

  const PAGES_PER_BATCH = 10;
  const ROWS_PER_PAGE = 50;

  const batch = Math.floor(
    (page - 1) / PAGES_PER_BATCH,
  );

  const activityQuery = useQuery({
    queryKey: [
      "store-activity",
      { batch },
    ],
    queryFn: async () => {
      console.log(
        "🟣 TANSTACK QUERY FN RUNNING: STORE ACTIVITY",
        { batch },
      );

      return getStoreActivityBatch(batch);
    },
    staleTime: 30_000,
  });

  const items = activityQuery.data?.data ?? [];

  const error =
    activityQuery.error instanceof Error
      ? activityQuery.error.message
      : activityQuery.data?.error;

  const activities = [...items].sort((a, b) => {
    const aTime = Date.parse(
      auditValue(a, [
        "createdAt",
        "timestamp",
        "date",
        "occurredAt",
      ]),
    );

    const bTime = Date.parse(
      auditValue(b, [
        "createdAt",
        "timestamp",
        "date",
        "occurredAt",
      ]),
    );

    return (
      (Number.isNaN(bTime) ? 0 : bTime) -
      (Number.isNaN(aTime) ? 0 : aTime)
    );
  });

  const batchPage =
    (page - 1) % PAGES_PER_BATCH;

  const start =
    batchPage * ROWS_PER_PAGE;

  const visibleActivities = activities.slice(
    start,
    start + ROWS_PER_PAGE,
  );

  const totalPages =
    activityQuery.data?.totalPages ?? 1;

  console.log("📊 STORE ACTIVITY PAGINATION", {
    loaded: items.length,
    total: activityQuery.data?.total,
    totalPages,
    });

  if (activityQuery.isPending) {
    return (
      <>
        <Header
          title="Store Activity"
          description="Review recent changes and actions across your store."
        />

        <div
          className={styles.loadingState}
          role="status"
        >
          <span
            className={styles.loadingSpinner}
            aria-hidden="true"
          />
          <strong>
            Loading store activity…
          </strong>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Store Activity"
        description="Review recent changes and actions across your store."
      />

      <Notice message={error} />

      {!error &&
      !visibleActivities.length ? (
        <div className={styles.emptyState}>
          <strong>
            No store activity yet
          </strong>
          <span>
            New store actions will appear here.
          </span>
        </div>
      ) : visibleActivities.length ? (
        <>
          <Table
            heads={[
              "Activity",
              "Resource",
              "Changes",
              "Source / Staff",
              "Date",
            ]}
          >
            {visibleActivities.map(
              (item, index) => {
                const occurredAt =
                  auditValue(item, [
                    "createdAt",
                    "timestamp",
                    "date",
                    "occurredAt",
                  ]);

                return (
                  <tr
                    key={text(
                      item.id,
                      `${occurredAt}-${index}`,
                    )}
                  >
                    <td>
                      <strong>
                        {auditValue(item, [
                          "action",
                          "event",
                          "type",
                        ]) ||
                          "Activity"}
                      </strong>
                    </td>

                    <td>
                      {auditValue(item, [
                        "resource",
                        "entity",
                        "entityType",
                        "model",
                      ]) || "—"}

                      <small>
                        {auditEntityLabel(
                          item,
                        )}
                      </small>

                      <small>
                        {auditValue(item, [
                          "resourceId",
                          "entityId",
                          "targetId",
                        ])}
                      </small>
                    </td>

                    <td
                      className={
                        styles.activityDetails
                      }
                    >
                      <AuditDetails item={item} />
                    </td>

                    <td>
                      <Status
                        value={
                          auditValue(item, [
                            "source",
                          ]) ||
                          "UNKNOWN"
                        }
                      />

                      <small>
                        {auditActor(item) ||
                          "—"}
                      </small>
                    </td>

                    <td
                      className={
                        styles.activityDate
                      }
                    >
                      {orderDate(
                        occurredAt,
                      )}
                    </td>
                  </tr>
                );
              },
            )}
          </Table>

          {totalPages > 1 ? (
            <nav
              className={
                styles.bundlePagination
              }
              aria-label="Store activity pagination"
            >
              <div
                className={
                  styles.bundlePaginationInfo
                }
              >
                Showing page{" "}
                <strong>{page}</strong> of{" "}
                <strong>{totalPages}</strong>
              </div>

              <div
                className={
                  styles.bundlePaginationActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.bundlePaginationButton
                  }
                  disabled={
                    page <= 1 ||
                    activityQuery.isFetching
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        current - 1,
                    )
                  }
                >
                  <span aria-hidden="true">
                    ←
                  </span>
                  Previous
                </button>

                <button
                  type="button"
                  className={
                    styles.bundlePaginationButton
                  }
                  disabled={
                    page >= totalPages ||
                    activityQuery.isFetching
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        current + 1,
                    )
                  }
                >
                  Next
                  <span aria-hidden="true">
                    →
                  </span>
                </button>
              </div>
            </nav>
          ) : null}
        </>
      ) : null}
    </>
  );
}