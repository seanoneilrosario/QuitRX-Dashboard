import Link from "next/link";
import type { StoreActivityItem } from "../../../../lib/quitmed-retail-admin/store-activity/client";
import style from "../../../components/dashboard.module.css";

type StoreActivityViewProps = {
  activity: StoreActivityItem;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatFieldName(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value || "—";
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getChanges(activity: StoreActivityItem) {
  const oldData = objectValue(activity.oldData);
  const newData = objectValue(activity.newData);

  const fields = Array.from(
    new Set([
      ...Object.keys(oldData),
      ...Object.keys(newData),
    ]),
  );

  return fields
    .filter(
      (field) =>
        JSON.stringify(oldData[field]) !==
        JSON.stringify(newData[field]),
    )
    .map((field) => ({
      field,
      before: formatChangeValue(oldData[field]),
      after: formatChangeValue(newData[field]),
    }));
}

export default function StoreActivityView({
  activity,
}: StoreActivityViewProps) {
  const changes = getChanges(activity);

  return (
    <div className={style.storeActivityView}>
      <div className={style.storeActivityViewTop}>
        <div>
          <span className={style.storeActivityEyebrow}>
            QUITRX OPERATIONS
          </span>

          <h1>Store Activity</h1>

          <p>
            View the complete details of this activity.
          </p>
        </div>

        <Link
          href="/dashboard/store-activity"
          className={style.storeActivityBackButton}
        >
          ← Back to Store Activity
        </Link>
      </div>

      <section className={style.storeActivitySummaryCard}>
        <div className={style.storeActivitySummaryTop}>
          <div>
            <span className={style.storeActivityDetailLabel}>
              ACTIVITY
            </span>

            <h2>{displayValue(activity.action)}</h2>
          </div>

          <span className={style.storeActivityBadge}>
            {displayValue(activity.source)}
          </span>
        </div>

        <div className={style.storeActivityMetaGrid}>
          <div>
            <span className={style.storeActivityDetailLabel}>
              RESOURCE
            </span>
            <strong>{displayValue(activity.entityType)}</strong>
          </div>

          <div>
            <span className={style.storeActivityDetailLabel}>
              RESOURCE ID
            </span>
            <strong>{displayValue(activity.entityId)}</strong>
          </div>

          <div>
            <span className={style.storeActivityDetailLabel}>
              STAFF USER ID
            </span>
            <strong>{displayValue(activity.userId)}</strong>
          </div>

          <div>
            <span className={style.storeActivityDetailLabel}>
              ACTIVITY ID
            </span>
            <strong>{displayValue(activity.id)}</strong>
          </div>

          <div>
            <span className={style.storeActivityDetailLabel}>
              DATE
            </span>
            <strong>{formatDate(activity.createdAt)}</strong>
          </div>
        </div>
      </section>

      <section className={style.storeActivityChangesCard}>
        <div className={style.storeActivitySectionHeader}>
          <div>
            <span>ACTIVITY DETAILS</span>
            <h2>Changes</h2>
          </div>
        </div>

        {changes.length > 0 ? (
          <div className={style.storeActivityChangeList}>
            {changes.map((change) => (
              <div
                key={change.field}
                className={style.storeActivityDetailChange}
              >
                <div className={style.storeActivityChangeField}>
                  {formatFieldName(change.field)}
                </div>

                <div className={style.storeActivityChangeValues}>
                  <span
                    className={style.storeActivityBefore}
                  >
                    {change.before}
                  </span>

                  <span
                    className={style.storeActivityChangeArrow}
                    aria-hidden="true"
                  >
                    →
                  </span>

                  <span
                    className={style.storeActivityAfter}
                  >
                    {change.after}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={style.storeActivityNoChanges}>
            {activity.action === "CREATE"
              ? "Record created"
              : activity.action === "DELETE"
                ? "Record deleted"
                : "No recorded field changes."}
          </div>
        )}
      </section>

      <div className={style.storeActivityDataGrid}>
        <section className={style.storeActivityDataCard}>
          <div className={style.storeActivitySectionHeader}>
            <div>
              <span>SNAPSHOT</span>
              <h2>Old Data</h2>
            </div>
          </div>

          <pre className={style.storeActivityJson}>
            {formatJson(activity.oldData)}
          </pre>
        </section>

        <section className={style.storeActivityDataCard}>
          <div className={style.storeActivitySectionHeader}>
            <div>
              <span>SNAPSHOT</span>
              <h2>New Data</h2>
            </div>
          </div>

          <pre className={style.storeActivityJson}>
            {formatJson(activity.newData)}
          </pre>
        </section>
      </div>

      <section className={style.storeActivityDataCard}>
        <div className={style.storeActivitySectionHeader}>
          <div>
            <span>ADDITIONAL INFORMATION</span>
            <h2>Metadata</h2>
          </div>
        </div>

        <pre className={style.storeActivityJson}>
          {formatJson(activity.metadata)}
        </pre>
      </section>
    </div>
  );
}