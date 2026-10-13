import Link from "next/link";

import CustomerEdit from "../customers-component/CustomerEdit";

import styles from "../../../components/dashboard.module.css";

import {
  getCustomer,
} from "@/lib/quitmed-retail-admin/customers/client";

type CustomerEditPageProps = {
  searchParams: Promise<{
    id?: string;
    returnTo?: string;
  }>;
};

const CUSTOMERS_PATH = "/dashboard/customers";

function getSafeReturnTo(
  value?: string,
): string {
  const fallback = CUSTOMERS_PATH;
  const candidate = value?.trim();

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//")
  ) {
    return fallback;
  }

  try {
    const url = new URL(
      candidate,
      "http://dashboard.local",
    );

    // Only permit returning to the customers list.
    // Preserve its query parameters.
    if (
      url.origin !== "http://dashboard.local" ||
      url.pathname !== CUSTOMERS_PATH
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export default async function CustomerEditPage({
  searchParams,
}: CustomerEditPageProps) {
  const params = await searchParams;

  const customerId = params.id?.trim() ?? "";
  const returnTo = getSafeReturnTo(params.returnTo);

  if (!customerId) {
    return (
      <div className={styles.pageHeader}>
        <div>
          <h1>Customer ID is required</h1>

          <p>
            No customer ID was provided.
          </p>

          <Link href={returnTo}>
            ← Back to customers
          </Link>
        </div>
      </div>
    );
  }

  let customer = null;
  let error: string | null = null;

  try {
    customer = await getCustomer(customerId);
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Failed to load customer.";
  }

  if (error) {
    return (
      <div className={styles.emptyState}>
        <strong>
          Failed to load customer
        </strong>

        <span>{error}</span>

        <Link href={returnTo}>
          ← Back to customers
        </Link>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className={styles.emptyState}>
        <strong>
          Customer not found
        </strong>

        <Link href={returnTo}>
          ← Back to customers
        </Link>
      </div>
    );
  }

  return (
    <CustomerEdit
      customer={customer}
      returnTo={returnTo}
    />
  );
}