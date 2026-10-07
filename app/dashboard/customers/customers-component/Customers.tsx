import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import type {
  RetailPagination,
  RetailRecord,
} from "@/lib/quitmed-retail-admin/collections/client";

type Props = {
  items: RetailRecord[];
  pagination: RetailPagination;
  query: string;
};

function text(
  value: unknown,
  fallback = "—",
): string {
  return typeof value === "string" ||
    typeof value === "number"
    ? String(value)
    : fallback;
}

function money(
  value: unknown,
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-AU",
    {
      style: "currency",
      currency: "AUD",
    },
  ).format(amount);
}

function fullName(
  customer: RetailRecord,
): string {
  const name = [
    text(customer.firstName, ""),
    text(customer.lastName, ""),
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Unnamed customer";
}

function statusClass(
  value: unknown,
): string {
  const status = text(
    value,
    "",
  ).toLowerCase();

  return /pending|draft|inactive|disabled|low/.test(
    status,
  )
    ? styles.warning
    : "";
}

function href(
  page: number,
  query: string,
): string {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (page > 1) {
    params.set(
      "page",
      String(page),
    );
  }

  const search =
    params.toString();

  return search
    ? `/dashboard/customers?${search}`
    : "/dashboard/customers";
}

export default function Customers({
  items,
  pagination,
  query,
}: Props) {
  return (
    <>
      <header
        className={
          styles.pageHeader
        }
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            QuitRX operations
          </p>

          <h1>Customers</h1>

          <p>
            Search customer accounts,
            purchase history and
            prescription information.
          </p>
        </div>
      </header>

      <div
        className={
          styles.toolbar
        }
      >
        <form
          className={
            styles.search
          }
          method="get"
        >
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            name="q"
            aria-label="Search customers"
            placeholder="Search name, email, phone or Shopify ID"
            defaultValue={query}
          />

          <button
            type="submit"
            className={
              styles.primary
            }
          >
            Search
          </button>
        </form>
      </div>

      <div
        className={
          styles.tableWrap
        }
      >
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Orders</th>
              <th>Total spent</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map(
              (
                customer,
                index,
              ) => {
                const id = text(
                  customer.id,
                  String(index),
                );

                return (
                  <tr key={id}>
                    <td>
                      <strong>
                        {fullName(
                          customer,
                        )}
                      </strong>

                      <small>
                        {text(
                          customer.id,
                        )}
                      </small>
                    </td>

                    <td>
                      {text(
                        customer.email,
                      )}

                      <small>
                        {text(
                          customer.phone,
                        )}
                      </small>
                    </td>

                    <td>
                      {text(
                        customer.numberOfOrders,
                        "0",
                      )}
                    </td>

                    <td>
                      {money(
                        customer.totalSpent,
                      )}
                    </td>

                    <td>
                      <span
                        className={`${styles.status} ${statusClass(
                          customer.state,
                        )}`}
                      >
                        {text(
                          customer.state,
                          "ACTIVE",
                        ).replaceAll(
                          "_",
                          " ",
                        )}
                      </span>
                    </td>

                    <td>
                      <Link
                        href={`/dashboard/customers/view?id=${encodeURIComponent(
                          id,
                        )}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>

      {!items.length ? (
        <div
          className={
            styles.notice
          }
        >
          <strong>
            No customers found
          </strong>

          <span>
            {query
              ? "Try changing the search."
              : "There are no customers to display."}
          </span>
        </div>
      ) : null}

      {pagination.totalPages >
      1 ? (
        <nav
          aria-label="Customer pagination"
          className={
            styles.pagination
          }
        >
          <div>
            {pagination.page >
            1 ? (
              <Link
                href={href(
                  pagination.page -
                    1,
                  query,
                )}
              >
                Previous
              </Link>
            ) : (
              <span>
                Previous
              </span>
            )}
          </div>

          <div>
            <span>
              Page{" "}
              {pagination.page}{" "}
              of{" "}
              {
                pagination.totalPages
              }
            </span>
          </div>

          <div>
            {pagination.page <
            pagination.totalPages ? (
              <Link
                href={href(
                  pagination.page +
                    1,
                  query,
                )}
              >
                Next
              </Link>
            ) : (
              <span>
                Next
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </>
  );
}