import Link from "next/link";

import CustomerView from "../customers-component/CustomerView";
import { getCustomer } from "@/lib/quitmed-retail-admin/customers/client";

type CustomerViewPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function CustomerViewPage({
  searchParams,
}: CustomerViewPageProps) {
  const params = await searchParams;

  if (!params.id) {
    return (
      <div className="p-6">
        <div className="mb-4">
          Customer ID is required.
        </div>

        <Link href="/dashboard/customers">
          ← Back to customers
        </Link>
      </div>
    );
  }

  let customer = null;
  let error: string | null = null;

  try {
    customer = await getCustomer(params.id);
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

        <Link href="/dashboard/customers">
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

        <Link href="/dashboard/customers">
          ← Back to customers
        </Link>
      </div>
    );
  }

  return <CustomerView customer={customer} />;
}