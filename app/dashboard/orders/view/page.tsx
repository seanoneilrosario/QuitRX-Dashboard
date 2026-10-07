import { notFound } from "next/navigation";

import OrderView from "../orders-components/OrderView";

import { getOrder } from "../../../../lib/quitmed-retail-admin/orders/client";

type PageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function OrderViewPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const orderId = params.id;

  if (!orderId) {
    notFound();
  }

  let order;

  try {
    order = await getOrder(orderId);
  } catch (error) {
    console.error(
      "[OrderViewPage] Failed to load order:",
      error,
    );

    notFound();
  }

  return <OrderView order={order} />;
}