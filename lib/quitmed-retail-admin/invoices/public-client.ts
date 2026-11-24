import "server-only";

import {
  API_BASE,
  apiKey,
} from "@/lib/quitmed-retail-admin/collections/client";

export type PublicInvoiceStatus =
  "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PENDING" | "FAILED" | "CANCELLED";

export type PublicInvoice = {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: string;
  paymentStatus: PublicInvoiceStatus;
  currencyCode: string;
  subtotal: string | number;
  discountTotal: string | number;
  shippingTotal: string | number;
  taxTotal: string | number;
  total: string | number;
  amountPaid: string | number;
  outstandingBalance: string | number;
  companyName?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  canRetryPayment?: boolean;
};

export class PublicInvoiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PublicInvoiceError";
  }
}

type PaymentSession = {
  sharedPaymentUrl: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unwrap(value: unknown) {
  const payload = objectValue(value);
  return Object.keys(objectValue(payload.data)).length
    ? objectValue(payload.data)
    : payload;
}

async function publicInvoiceRequest(
  token: string,
  init: RequestInit,
  suffix = "",
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${API_BASE}/invoices/${encodeURIComponent(token)}${suffix}`,
    {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey(),
        ...init.headers,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new PublicInvoiceError(
      response.status === 404 || response.status === 410
        ? "This invoice payment link is invalid or has expired."
        : "We could not load this invoice. Please try again shortly.",
      response.status,
    );
  }

  return unwrap(await response.json());
}

export async function getPublicInvoice(token: string) {
  return (await publicInvoiceRequest(token, {
    method: "GET",
  })) as PublicInvoice;
}

export async function createInvoicePaymentSession(token: string) {
  const data = await publicInvoiceRequest(token, { method: "POST" }, "/pay");

  return {
    sharedPaymentUrl: String(
      data.sharedPaymentUrl ?? data.SharedPaymentUrl ?? "",
    ),
  } satisfies PaymentSession;
}
