import Orders from "./orders-components/Orders";

import {
  getOrders,
  type GetOrdersParams,
} from "../../../lib/quitmed-retail-admin/orders/client";

type PageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    source?: string;
  }>;
};

export default async function OrdersPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const page = Math.max(
    Number.parseInt(params.page ?? "1", 10) || 1,
    1,
  );

    const query: GetOrdersParams = {
        page,
        limit: 20,
        fields:
            "id,name,source,customerName,customerEmail,items,total,payment,fulfillment,date",
        search: params.search,
        status: params.status,
        paymentStatus: params.paymentStatus,
        fulfillmentStatus: params.fulfillmentStatus,
        source: params.source,
    };

  try {
    const result = await getOrders(query);

    console.log(result.data)

    return (
      <Orders
        orders={result.data}
        pagination={result.pagination}
        query={query}
      />
    );
  } catch (error) {
    console.error(
      "[OrdersPage] Failed to load orders:",
      error,
    );

    return (
      <Orders
        orders={[]}
        pagination={{
          page,
          limit: 20,
          total: 0,
          totalPages: 0,
        }}
        query={query}
        error="We couldn’t load the orders right now."
      />
    );
  }
}