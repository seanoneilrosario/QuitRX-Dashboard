import { retailRequest } from "../collections/client";

export type OrderCustomer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type OrderItem = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitPrice: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  total: string | number;
  createdAt: string;
  updatedAt: string;
};

export type Order = {
  id: string;
  customerId?: string | null;
  orderNumber: string;

  qoblexInvoiceId?: string | null;
  starshipitOrderId?: string | null;

  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  shipmentStatus?: string | null;

  source: string;
  sourceOrderId?: string | null;

  currencyCode: string;
  subtotal: string | number;
  discountTotal: string | number;
  shippingTotal: string | number;
  shippingMethod?: string | null;
  taxTotal: string | number;
  total: string | number;

  billingFirstName?: string | null;
  billingLastName?: string | null;
  billingCompany?: string | null;
  billingAddress1?: string | null;
  billingAddress2?: string | null;
  billingCity?: string | null;
  billingProvince?: string | null;
  billingCountry?: string | null;
  billingZip?: string | null;
  billingPhone?: string | null;

  shippingFirstName?: string | null;
  shippingLastName?: string | null;
  shippingCompany?: string | null;
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingCountry?: string | null;
  shippingZip?: string | null;
  shippingPhone?: string | null;

  customer?: OrderCustomer | null;
  items: OrderItem[];

  createdAt: string;
  updatedAt: string;
};

export type OrdersResponse = {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type GetOrdersParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  source?: string;
  customerId?: string;
  fields?: string;
};

export async function getOrders(
  params: GetOrdersParams = {},
): Promise<{
  data: OrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const query = new URLSearchParams();

  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));

  if (params.fields?.trim()) {
    query.set("fields", params.fields);
  }

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.status) {
    query.set("status", params.status);
  }

  if (params.paymentStatus) {
    query.set("paymentStatus", params.paymentStatus);
  }

  if (params.fulfillmentStatus) {
    query.set(
      "fulfillmentStatus",
      params.fulfillmentStatus,
    );
  }

  if (params.source) {
    query.set("source", params.source);
  }

  if (params.customerId) {
    query.set("customerId", params.customerId);
  }

  return retailRequest(
    `/orders?${query.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export async function getOrder(orderId: string): Promise<Order> {
  return retailRequest<Order>(
    `/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export type OrderListItem = {
  id: string;
  orderNumber: string;
  source: string;
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  items: {
    quantity: number;
  }[];
  total: string | number;
  paymentStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
};

export async function deleteOrder(
  orderId: string,
): Promise<{ message: string }> {
  return retailRequest<{ message: string }>(
    `/orders/${encodeURIComponent(orderId)}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
}