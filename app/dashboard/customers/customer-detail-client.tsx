"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomer } from "@/app/dashboard/actions";

export default function CustomerDetailClient({
  id,
  initialData,
}: {
  id: string;
  initialData?: Awaited<ReturnType<typeof getCustomer>>;
}) {
  const customerQuery = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
    initialData,
  });

  console.log("Customer detail query:", {
    id,
    data: customerQuery.data,
    isFetched: customerQuery.isFetched,
    isFetchedAfterMount: customerQuery.isFetchedAfterMount,
    isStale: customerQuery.isStale,
  });

  if (customerQuery.isPending) {
    return <p>Loading customer...</p>;
  }

  if (customerQuery.error) {
    return <p>Unable to load customer.</p>;
  }

  return (
    <pre>
      {JSON.stringify(customerQuery.data, null, 2)}
    </pre>
  );
}