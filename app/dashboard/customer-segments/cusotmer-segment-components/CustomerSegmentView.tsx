
"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  CustomerSegmentMembersResponse,
  CustomerSegmentRule,
} from "@/lib/quitmed-retail-admin/customer-segments/client";

import styles from "./customer-segments.module.css";
import { getCustomerSegmentMembersAction } from "@/lib/quitmed-retail-admin/customer-segments/customer-segment-actions";

const FIELD_LABELS: Record<string, string> = {
  shopifyId: "Shopify ID",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  currencyCode: "Currency code",
  state: "State",
  gender: "Gender",
  scriptId: "Script ID",
  scriptValidity: "Script validity",
  renewalForm: "Renewal form",
  vapeTag: "Vape tag",
  pouchTag: "Pouch tag",
  document: "Document",
  socLogin: "Social login",
  scriptUploaded: "Script uploaded",
  numberOfOrders: "Number of orders",
  totalSpent: "Total spent",
  taxExempt: "Tax exempt",
  verifiedEmail: "Verified email",
  consultPurchase: "Consult purchase",
  scriptActive: "Script active",
  birthday: "Birthday",
  scriptExpiry: "Script expiry",
  createdAt: "Customer created date",
  updatedAt: "Customer updated date",
  tags: "Customer tags",
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: "is equal to",
  notEquals: "is not equal to",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "is greater than",
  greaterThanOrEqual: "is at least",
  lessThan: "is less than",
  lessThanOrEqual: "is at most",
  before: "is before",
  after: "is after",
  onOrBefore: "is on or before",
  onOrAfter: "is on or after",
  hasTag: "includes tag",
  notHasTag: "does not include tag",
  hasAnyTag: "includes any of",
  hasAllTags: "includes all of",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

function formatRuleValue(rule: CustomerSegmentRule): string {
  if (rule.operator === "isEmpty") return "Empty";
  if (rule.operator === "isNotEmpty") return "Not empty";

  if (typeof rule.value === "boolean") {
    return rule.value ? "Yes" : "No";
  }

  if (Array.isArray(rule.value)) {
    return rule.value.join(", ");
  }

  if (rule.value === undefined || rule.value === null || rule.value === "") {
    return "—";
  }

  return String(rule.value);
}

type Props = {
  initialResponse: CustomerSegmentMembersResponse;
};

function formatMoney(value: number | string, currencyCode: string | null) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return String(value);

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currencyCode || "AUD",
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-AU");
}

export default function CustomerSegmentView({
  initialResponse,
}: Props) {
  const [response, setResponse] = useState(initialResponse);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const segment = response.segment;
  const pagination = response.pagination;
  const totalPages = Math.max(1, pagination.totalPages);

  async function loadMembers(page: number, search: string) {
    setLoading(true);
    setError("");

    try {
      const result = await getCustomerSegmentMembersAction(segment.id, {
        page,
        limit: pagination.limit || 20,
        search,
      });

      setResponse(result);
      setActiveSearch(search);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to load segment customers.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadMembers(1, searchInput.trim());
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CUSTOMERS / SEGMENTS</p>
          <h1>{segment.name}</h1>
          <p className={styles.subtitle}>
            {segment.description || "Customers matching this segment's rules."}
          </p>
        </div>

        <div className={styles.viewHeaderActions}>
          <Link
            href={`/dashboard/customer-segments/edit?id=${encodeURIComponent(segment.id)}`}
            className={styles.primaryButton}
          >
            Edit segment
          </Link>

          <Link
            href="/dashboard/customer-segments"
            className={styles.secondaryButton}
          >
            Back to segments
          </Link>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.segmentSummary}>
          <div>
            <span className={styles.summaryLabel}>Matching customers</span>
            <strong>{pagination.total}</strong>
          </div>

          <div>
            <span className={styles.summaryLabel}>Matching rules</span>
            <strong>
              Match {segment.matchMode === "ALL" ? "all" : "any"}
            </strong>
          </div>

          <div>
            <span className={styles.summaryLabel}>Status</span>
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Segment conditions</h2>
            <p>
              Customers must match{" "}
              {segment.matchMode === "ALL" ? "all" : "any"} of these conditions.
            </p>
          </div>
        </div>

        {!segment.rules || segment.rules.length === 0 ? (
          <div className={styles.empty}>
            No conditions configured. This segment currently matches no customers.
          </div>
        ) : (
          <div className={styles.conditionList}>
            {segment.rules.map((rule, index) => (
              <div className={styles.conditionRow} key={`${rule.field}-${index}`}>
                <span className={styles.conditionField}>
                  {FIELD_LABELS[rule.field] ?? rule.field}
                </span>

                <span className={styles.conditionOperator}>
                  {OPERATOR_LABELS[rule.operator] ?? rule.operator}
                </span>

                <strong className={styles.conditionValue}>
                  {formatRuleValue(rule)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Segment customers</h2>
            <p>
              Select a customer to open their existing customer details page.
            </p>
          </div>
        </div>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            className={styles.input}
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email, or phone"
            aria-label="Search segment customers"
          />

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={loading}
          >
            Search
          </button>

          {activeSearch && (
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={loading}
              onClick={() => {
                setSearchInput("");
                void loadMembers(1, "");
              }}
            >
              Clear
            </button>
          )}
        </form>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.tableWrapper} aria-busy={loading}>
          <table className={styles.customerTable}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Total spent</th>
                <th>State</th>
                <th>Customer since</th>
              </tr>
            </thead>

            <tbody>
              {response.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.tableEmpty}>
                    {loading
                      ? "Loading customers..."
                      : activeSearch
                        ? "No customers match your search."
                        : "No customers currently belong to this segment."}
                  </td>
                </tr>
              ) : (
                response.data.map((customer) => {
                  const customerName = [
                    customer.firstName,
                    customer.lastName,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr key={customer.id}>
                      <td>
                        <Link
                          className={styles.customerLink}
                          href={`/dashboard/customers/view?id=${encodeURIComponent(customer.id)}`}
                        >
                          {customerName || customer.email || "Unnamed customer"}
                        </Link>
                      </td>

                      <td>{customer.email || "—"}</td>
                      <td>{customer.phone || "—"}</td>
                      <td>{customer.numberOfOrders ?? 0}</td>
                      <td>
                        {formatMoney(
                          customer.totalSpent,
                          customer.currencyCode,
                        )}
                      </td>
                      <td>{customer.state || "—"}</td>
                      <td>{formatDate(customer.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <span>
            Page {pagination.page} of {totalPages}
            {" · "}
            {pagination.total} customers
          </span>

          <div className={styles.paginationActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={loading || pagination.page <= 1}
              onClick={() =>
                void loadMembers(pagination.page - 1, activeSearch)
              }
            >
              Previous
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              disabled={
                loading ||
                pagination.page >= pagination.totalPages
              }
              onClick={() =>
                void loadMembers(pagination.page + 1, activeSearch)
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
