import { getCustomers } from "@/lib/quitmed-retail-admin/customers/client";
import Customers from "./customers-component/Customers";

type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function CustomersPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const query =
    typeof params.q === "string"
      ? params.q.trim()
      : "";

  const page = Math.max(
    1,
    Number(params.page) || 1,
  );

  const result = await getCustomers({
    page,
    limit: 20,
    query,
    fields:
      "firstName,lastName,email,numberOfOrders,totalSpent,scriptActive,id,phone",
  });

  return (
    <Customers
      items={result.data}
      pagination={result.pagination}
      query={query}
    />
  );
}