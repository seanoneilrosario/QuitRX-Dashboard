"use server";

import { deleteOrder, Order } from "./client";

export async function deleteOrderAction(orderId: string) {
  try {
    await deleteOrder(orderId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("[order-actions] delete failed", error);

    return {
      success: false,
      error: "Failed to delete order.",
    };
  }
}

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { retailRequest } from "../collections/client";

type CancelOrderResult =
  { success: true; message: string } | { success: false; error: string };

export async function cancelOrderAction(
  orderId: string,
): Promise<CancelOrderResult> {
  try {
    const id = orderId.trim();

    if (!id) {
      throw new Error("Order ID is required.");
    }

    // Only allow signed-in staff to cancel orders.
    const session = await auth();
    const staffUser = session?.user as { isStaff?: boolean } | undefined;

    if (!staffUser?.isStaff) {
      throw new Error("You must be signed in as staff to cancel orders.");
    }

    await retailRequest(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/orders/details");
    revalidatePath("/dashboard/inventory");

    return {
      success: true,
      message: "Order cancelled successfully.",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to cancel order.",
    };
  }
}

export type CreateOrderPayload = {
  sendInvoice?: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  source: "NATIVE";
  currencyCode: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  shippingMethod: string;
  taxTotal: number;
  total: number;
  billingFirstName?: string;
  billingLastName?: string;
  billingCompany?: string;
  billingAddress1?: string;
  billingAddress2?: string;
  billingCity?: string;
  billingProvince?: string;
  billingCountry?: string;
  billingZip?: string;
  billingPhone?: string;
  shippingFirstName?: string;
  shippingLastName?: string;
  shippingCompany?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingProvince?: string;
  shippingCountry?: string;
  shippingZip?: string;
  shippingPhone?: string;
  discountCode?: string;
  items: {
    variantId: string;
    quantity: number;
  }[];
};

export async function createOrderAction(payload: CreateOrderPayload) {
  try {
    const result = await retailRequest<Order>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    console.log("[createOrderAction] result:", result);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[createOrderAction]", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to create order.",
    };
  }
}

export type InvoiceStatus = "NOT_SENT" | "SENT" | "FAILED";

export type OrderInvoice = {
  id: string;
  invoiceNumber: string;
  customerEmail: string;
  status: InvoiceStatus;
  createdAt: string;
  lastSentAt?: string | null;
  previewUrl?: string | null;
  paymentStatus?: string;
};

type InvoicePaymentLink = {
  success: boolean;
  orderId: string;
  invoiceNumber: string;
  customer: { email: string | null };
  paymentStatus: string;
  previewUrl: string;
  paymentUrl: string;
  createdAt: string;
};

type InvoiceActionResult =
  { success: true; data: OrderInvoice } | { success: false; message: string };

async function requireStaff() {
  const session = await auth();
  const user = session?.user as { isStaff?: boolean } | undefined;

  if (!user?.isStaff) {
    throw new Error("You must be signed in as staff to manage invoices.");
  }
}

function invoiceError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to manage this invoice.";
}

export async function getOrCreateOrderInvoiceAction(
  orderId: string,
): Promise<InvoiceActionResult> {
  try {
    await requireStaff();
    const id = orderId.trim();

    if (!id) throw new Error("Order ID is required.");

    const link = await retailRequest<InvoicePaymentLink>(
      `/orders/${encodeURIComponent(id)}/invoice/token`,
      { method: "POST", cache: "no-store" },
    );

    if (!link.success || !(link.previewUrl || link.paymentUrl)) {
      throw new Error("Unable to generate the invoice preview link.");
    }

    const data: OrderInvoice = {
      id: link.orderId,
      invoiceNumber: link.invoiceNumber,
      customerEmail: link.customer?.email ?? "",
      status: "NOT_SENT",
      paymentStatus: link.paymentStatus,
      previewUrl: link.previewUrl || link.paymentUrl,
      createdAt: link.createdAt,
    };

    return { success: true, data };
  } catch (error) {
    return { success: false, message: invoiceError(error) };
  }
}

export async function sendOrderInvoiceAction(
  orderId: string,
): Promise<{ success: true; data: Partial<OrderInvoice> } | { success: false; message: string }> {
  try {
    await requireStaff();
    const id = orderId.trim();

    if (!id) throw new Error("Order ID is required.");

    const data = await retailRequest<Partial<OrderInvoice> | null>(
      `/orders/${encodeURIComponent(id)}/invoice/send`,
      { method: "POST", body: JSON.stringify({ sendInvoice: "true" }), cache: "no-store" },
    );

    return { success: true, data: data ?? {} };
  } catch (error) {
    return { success: false, message: invoiceError(error) };
  }
}

export async function searchOrderCustomers(search: string) {
  const query = new URLSearchParams({
    page: "1",
    limit: "20",
  });

  if (search.trim()) {
    query.set("search", search.trim());
  }

  const response = await retailRequest<unknown>(
    `/customers?${query.toString()}`,
    { cache: "no-store" },
  );

  return extractRecords(response);
}

export async function searchOrderVariants(search: string) {
  const query = new URLSearchParams({
    page: "1",
    limit: "50",
    fields: "id,sku,name,price,product",
  });

  if (search.trim()) {
    query.set("search", search.trim());
  }

  const response = await retailRequest<unknown>(
    `/product-variants?${query.toString()}`,
    { cache: "no-store" },
  );

  return extractRecords(response);
}

export async function getOrderCustomer(customerId: string) {
  const response = await retailRequest<unknown>(
    `/customers/${encodeURIComponent(customerId)}`,
    { cache: "no-store" },
  );

  if (response && typeof response === "object" && !Array.isArray(response)) {
    const wrapper = response as Record<string, unknown>;

    if (
      wrapper.data &&
      typeof wrapper.data === "object" &&
      !Array.isArray(wrapper.data)
    ) {
      return wrapper.data as Record<string, unknown>;
    }

    return wrapper;
  }

  return null;
}

function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item)),
    );
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const wrapper = payload as Record<string, unknown>;

  for (const key of [
    "data",
    "customers",
    "products",
    "variants",
    "items",
    "results",
  ]) {
    if (Array.isArray(wrapper[key])) {
      return extractRecords(wrapper[key]);
    }
  }

  return [];
}
