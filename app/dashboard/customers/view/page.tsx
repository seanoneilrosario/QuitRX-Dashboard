import Link from "next/link";

import CustomerView from "../customers-component/CustomerView";

import {
  getCustomer,
} from "@/lib/quitmed-retail-admin/customers/client";

type CustomerViewPageProps = {
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
    // Preserve search and pagination query parameters.
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

export default async function CustomerViewPage({
  searchParams,
}: CustomerViewPageProps) {
  const params = await searchParams;

  const customerId = params.id?.trim() ?? "";
  const returnTo = getSafeReturnTo(params.returnTo);

  if (!customerId) {
    return (
      <div className="p-6">
        <div className="mb-4">
          Customer ID is required.
        </div>

        <Link href={returnTo}>
          ← Back to customers
        </Link>
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
      <div className="p-6">
        <div className="mb-4">
          {error}
        </div>

        <Link href={returnTo}>
          ← Back to customers
        </Link>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="mb-4">
          Customer not found.
        </div>

        <Link href={returnTo}>
          ← Back to customers
        </Link>
      </div>
    );
  }

  return (
    <CustomerView
      customer={customer}
      returnTo={returnTo}
    />
  );
}