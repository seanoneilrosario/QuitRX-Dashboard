import Link from "next/link";

import CustomerEdit from "../customers-component/CustomerEdit";

import style from "../../../components/dashboard.module.css"

import {
  getCustomer,
} from "@/lib/quitmed-retail-admin/customers/client";

type CustomerEditPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function CustomerEditPage({
  searchParams,
}: CustomerEditPageProps) {
  const params =
    await searchParams;

  if (!params.id) {
    return (
      <div className={style.pageHeader}>
        <div>
          <h1>
            Customer ID is required
          </h1>

          <p>
            No customer ID was provided.
          </p>

          <Link
            href="/dashboard/customers"
          >
            ← Back to customers
          </Link>
        </div>
      </div>
    );
  }

  let customer = null;
  let error: string | null = null;

  try {
    customer =
      await getCustomer(
        params.id,
      );
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Failed to load customer.";
  }

  if (error) {
    return (
      <div className={style.emptyState}>
        <strong>
          Failed to load customer
        </strong>

        <span>{error}</span>

        <Link
          href="/dashboard/customers"
        >
          ← Back to customers
        </Link>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className={style.emptyState}>
        <strong>
          Customer not found
        </strong>

        <Link
          href="/dashboard/customers"
        >
          ← Back to customers
        </Link>
      </div>
    );
  }

  return (
    <CustomerEdit
      customer={customer}
    />
  );
}