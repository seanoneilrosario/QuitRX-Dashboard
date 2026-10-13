import { getCustomers } from "@/lib/quitmed-retail-admin/customers/client";

import Customers from "./customers-component/Customers";

type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

const CUSTOMERS_PATH = "/dashboard/customers";

export default async function CustomersPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const query =
    typeof params.q === "string"
      ? params.q.trim()
      : "";

  const requestedPage = Math.max(
    1,
    Number(params.page) || 1,
  );

  const result = await getCustomers({
    page: requestedPage,
    limit: 20,
    query,
    fields:
      "firstName,lastName,email,numberOfOrders,totalSpent,scriptActive,id,phone",
  });

  // Use the page returned by the API when available.
  const currentPage = Math.max(
    1,
    result.pagination.page || requestedPage,
  );

  // Preserve the search query and current page when navigating
  // from the customer list to View or Edit.
  const returnParams = new URLSearchParams();

  if (query) {
    returnParams.set("q", query);
  }

  if (currentPage > 1) {
    returnParams.set("page", String(currentPage));
  }

  const queryString = returnParams.toString();

  const returnTo = queryString
    ? `${CUSTOMERS_PATH}?${queryString}`
    : CUSTOMERS_PATH;

  return (
    <Customers
      items={result.data}
      pagination={result.pagination}
      query={query}
      returnTo={returnTo}
    />
  );
}